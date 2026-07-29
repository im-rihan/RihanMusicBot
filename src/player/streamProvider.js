const { spawn } = require('child_process');
const fs = require('fs');
const { StreamType } = require('@discordjs/voice');
const ffmpegPath = require('ffmpeg-static');
const play = require('play-dl');
const { createLogger } = require('../utils/logger');
const { getCookiesPath } = require('../utils/cookies');
const { YOUTUBE_DL_PATH } = require('youtube-dl-exec/src/constants');

const logger = createLogger('stream');

function resolveYtdlpBin() {
  const candidates = [
    process.env.YTDLP_PATH,
    '/usr/local/bin/yt-dlp',
    YOUTUBE_DL_PATH,
  ].filter(Boolean);

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch {
      // ignore
    }
  }
  return YOUTUBE_DL_PATH;
}

function buildAf({ volume = 100, filterAf = null } = {}) {
  const parts = [];
  if (filterAf) parts.push(filterAf);
  if (volume !== 100) {
    const vol = Math.max(0.01, Math.min(2, volume / 100));
    parts.push(`volume=${vol}`);
  }
  return parts.length ? parts.join(',') : null;
}

function buildYtdlpArgs(pageUrl) {
  const args = [
    pageUrl,
    '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
    '-o', '-',
    '--no-playlist',
    '--no-check-certificates',
    // Modern YouTube needs a JS runtime for nsig / challenges
    '--js-runtimes', 'deno',
    '--extractor-args', 'youtube:player_client=web,mweb,android,ios',
  ];

  const cookies = getCookiesPath();
  if (cookies) {
    args.push('--cookies', cookies);
  }

  return args;
}

/**
 * Stream YouTube (and most sites) via yt-dlp piped into FFmpeg.
 * Waits for the first audio chunk so bot-check failures surface clearly.
 */
function streamWithYtdlp(pageUrl, options = {}) {
  const af = buildAf(options);

  return new Promise((resolve, reject) => {
    const bin = resolveYtdlpBin();
    logger.info(`yt-dlp binary: ${bin}`);
    const ytdlp = spawn(bin, buildYtdlpArgs(pageUrl), {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PATH: `/usr/local/bin:${process.env.PATH || ''}`,
      },
    });

    const ffmpegArgs = [
      '-analyzeduration', '0',
      '-loglevel', 'error',
      '-i', 'pipe:0',
    ];
    if (af) ffmpegArgs.push('-af', af);
    ffmpegArgs.push('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');

    const ffmpeg = spawn(ffmpegPath, ffmpegArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    ytdlp.stdout.pipe(ffmpeg.stdin);
    ytdlp.stdout.on('error', () => {});
    ffmpeg.stdin.on('error', () => {});

    let yErr = '';
    let fErr = '';
    let settled = false;

    ytdlp.stderr.on('data', (c) => {
      yErr += c.toString();
      if (yErr.length > 2500) yErr = yErr.slice(-2500);
    });
    ffmpeg.stderr.on('data', (c) => {
      fErr += c.toString();
      if (fErr.length > 1500) fErr = fErr.slice(-1500);
    });

    const cleanup = () => {
      try { ytdlp.kill('SIGKILL'); } catch { /* ignore */ }
      try { ffmpeg.kill('SIGKILL'); } catch { /* ignore */ }
    };

    const fail = (msg) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(msg));
    };

    ytdlp.on('exit', (code) => {
      if (code && code !== 0 && !settled) {
        const detail = yErr.trim() || 'unknown yt-dlp error';
        if (/sign in|not a bot|cookies/i.test(detail)) {
          fail(
            'YouTube blocked this cloud server. Add YOUTUBE_COOKIES (or YOUTUBE_COOKIES_BASE64) in Railway. See README.'
          );
        } else {
          fail(`yt-dlp failed: ${detail.slice(-500)}`);
        }
      }
    });

    ffmpeg.on('exit', (code) => {
      if (code && code !== 0 && !settled) {
        fail(`ffmpeg failed: ${(fErr || 'no output').trim().slice(0, 200)}`);
      }
    });

    // Wait until audio actually starts so cookie/bot-check errors are caught
    const onFirst = (chunk) => {
      if (settled) return;
      settled = true;
      ffmpeg.stdout.off('error', onOutErr);

      const { Readable } = require('stream');
      const stream = new Readable({
        read() {},
      });
      stream.push(chunk);
      ffmpeg.stdout.on('data', (c) => stream.push(c));
      ffmpeg.stdout.on('end', () => stream.push(null));
      ffmpeg.stdout.on('error', (err) => stream.destroy(err));

      resolve({
        stream,
        type: StreamType.Raw,
        process: { kill: cleanup, ytdlp, ffmpeg },
      });
    };

    const onOutErr = (err) => fail(err.message || 'Audio stream error');

    ffmpeg.stdout.once('data', onFirst);
    ffmpeg.stdout.once('error', onOutErr);

    setTimeout(() => {
      if (!settled) {
        fail('Timed out starting audio stream (YouTube may be blocking this host).');
      }
    }, 45_000);
  });
}

async function createTrackStream(track, options = {}) {
  const isSoundCloud = /soundcloud\.com/i.test(track.url) || track.source === 'SoundCloud';

  if (isSoundCloud) {
    try {
      const s = await play.stream(track.url, { quality: 2 });
      const af = buildAf(options);
      if (!af) {
        return { stream: s.stream, type: s.type || StreamType.Arbitrary, process: null };
      }
      const ffmpeg = spawn(ffmpegPath, [
        '-analyzeduration', '0',
        '-loglevel', 'error',
        '-i', 'pipe:0',
        '-af', af,
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1',
      ], { stdio: ['pipe', 'pipe', 'ignore'] });
      s.stream.pipe(ffmpeg.stdin);
      s.stream.on('error', () => {
        try { ffmpeg.kill('SIGKILL'); } catch { /* ignore */ }
      });
      ffmpeg.stdin.on('error', () => {});
      return { stream: ffmpeg.stdout, type: StreamType.Raw, process: ffmpeg };
    } catch (err) {
      logger.warn('SoundCloud play-dl failed, falling back to yt-dlp:', err.message);
    }
  }

  const cookies = getCookiesPath();
  logger.info(
    `Streaming via yt-dlp: ${track.title} (cookies: ${cookies ? 'yes' : 'no'})`
  );
  return streamWithYtdlp(track.url, options);
}

module.exports = {
  createTrackStream,
};
