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

function ytdlpBaseArgs(pageUrl, extra = []) {
  const args = [
    pageUrl,
    '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
    '--no-playlist',
    '--no-check-certificates',
    '--js-runtimes', 'deno',
    '--extractor-args', 'youtube:player_client=web,mweb,android,ios',
    ...extra,
  ];

  const cookies = getCookiesPath();
  if (cookies) args.push('--cookies', cookies);
  return args;
}

function runYtdlp(args, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const bin = resolveYtdlpBin();
    const child = spawn(bin, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `/usr/local/bin:${process.env.PATH || ''}` },
    });

    let out = '';
    let err = '';
    child.stdout.on('data', (c) => { out += c.toString(); });
    child.stderr.on('data', (c) => {
      err += c.toString();
      if (err.length > 4000) err = err.slice(-4000);
    });

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch { /* ignore */ }
      reject(new Error(`yt-dlp timed out.\n${err.trim().slice(-500)}`));
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve({ out, err });
      else reject(new Error((err || out || `yt-dlp exit ${code}`).trim().slice(-800)));
    });
  });
}

async function resolveAudioUrl(pageUrl) {
  logger.info(`Resolving audio URL via yt-dlp: ${pageUrl}`);
  const { out, err } = await runYtdlp(ytdlpBaseArgs(pageUrl, ['-g', '--no-warnings']));
  const url = out
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.startsWith('http'));

  if (!url) {
    throw new Error(`yt-dlp returned no audio URL.\n${(err || out).trim().slice(-500)}`);
  }
  logger.info('Audio URL resolved');
  return url;
}

function ffmpegFromUrl(audioUrl, options = {}) {
  const af = buildAf(options);
  const args = [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-analyzeduration', '0',
    '-loglevel', 'error',
    '-i', audioUrl,
  ];
  if (af) args.push('-af', af);
  args.push('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');

  const ffmpeg = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let fErr = '';
  ffmpeg.stderr.on('data', (c) => {
    fErr += c.toString();
    if (fErr.length > 1500) fErr = fErr.slice(-1500);
  });

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      try { ffmpeg.kill('SIGKILL'); } catch { /* ignore */ }
    };

    const fail = (msg) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(msg));
    };

    ffmpeg.on('exit', (code) => {
      if (code && code !== 0 && !settled) {
        fail(`ffmpeg failed: ${(fErr || 'no output').trim().slice(0, 240)}`);
      }
    });

    ffmpeg.stdout.once('data', (chunk) => {
      if (settled) return;
      settled = true;
      logger.info('Audio stream started');

      const { Readable } = require('stream');
      const stream = new Readable({ read() {} });
      stream.push(chunk);
      ffmpeg.stdout.on('data', (c) => stream.push(c));
      ffmpeg.stdout.on('end', () => stream.push(null));
      ffmpeg.stdout.on('error', (err) => stream.destroy(err));

      resolve({
        stream,
        type: StreamType.Raw,
        process: { kill: cleanup, ffmpeg },
      });
    });

    ffmpeg.stdout.once('error', (err) => fail(err.message || 'Audio stream error'));

    setTimeout(() => {
      if (!settled) fail('Timed out waiting for ffmpeg audio.');
    }, 30_000);
  });
}

async function streamWithYtdlp(pageUrl, options = {}) {
  try {
    const audioUrl = await resolveAudioUrl(pageUrl);
    return ffmpegFromUrl(audioUrl, options);
  } catch (err) {
    const detail = err.message || String(err);
    if (/sign in|not a bot|cookies/i.test(detail)) {
      throw new Error(
        'YouTube blocked this cloud server. Re-export cookies and set YOUTUBE_COOKIES_BASE64 on Railway.'
      );
    }
    throw new Error(`yt-dlp failed: ${detail.slice(-500)}`);
  }
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
  logger.info(`yt-dlp binary: ${resolveYtdlpBin()}`);
  return streamWithYtdlp(track.url, options);
}

module.exports = {
  createTrackStream,
};
