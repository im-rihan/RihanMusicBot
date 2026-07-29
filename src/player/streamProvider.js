const { spawn } = require('child_process');
const fs = require('fs');
const { Readable } = require('stream');
const { StreamType } = require('@discordjs/voice');
const ffmpegPath = require('ffmpeg-static');
const play = require('play-dl');
const { createLogger } = require('../utils/logger');
const { getCookiesPath } = require('../utils/cookies');
const { YOUTUBE_DL_PATH } = require('youtube-dl-exec/src/constants');

const logger = createLogger('stream');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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
    '--user-agent', USER_AGENT,
    '--referer', 'https://www.youtube.com/',
    ...extra,
  ];

  const cookies = getCookiesPath();
  if (cookies) args.push('--cookies', cookies);
  return args;
}

function runYtdlp(args, timeoutMs = 90_000) {
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

function wrapFfmpegStdout(ffmpeg, cleanup) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let fErr = '';

    ffmpeg.stderr.on('data', (c) => {
      fErr += c.toString();
      if (fErr.length > 2000) fErr = fErr.slice(-2000);
    });

    const fail = (msg) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(msg));
    };

    ffmpeg.on('exit', (code) => {
      if (code && code !== 0 && !settled) {
        fail(`ffmpeg failed: ${(fErr || 'no output').trim().slice(0, 300)}`);
      }
    });

    ffmpeg.stdout.once('data', (chunk) => {
      if (settled) return;
      settled = true;
      logger.info('Audio stream started');

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
      if (!settled) {
        fail(`Timed out waiting for ffmpeg audio.${fErr ? ` ${fErr.trim().slice(-200)}` : ''}`);
      }
    }, 45_000);
  });
}

function ffmpegFromUrl(audioUrl, options = {}) {
  const af = buildAf(options);
  // YouTube CDN URLs require browser-like headers or they hang/403
  const args = [
    '-reconnect', '1',
    '-reconnect_streamed', '1',
    '-reconnect_delay_max', '5',
    '-user_agent', USER_AGENT,
    '-referer', 'https://www.youtube.com/',
    '-headers', 'Accept-Language: en-US,en;q=0.9\r\nOrigin: https://www.youtube.com\r\n',
    '-analyzeduration', '0',
    '-loglevel', 'error',
    '-i', audioUrl,
  ];
  if (af) args.push('-af', af);
  args.push('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');

  const ffmpeg = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const cleanup = () => {
    try { ffmpeg.kill('SIGKILL'); } catch { /* ignore */ }
  };

  return wrapFfmpegStdout(ffmpeg, cleanup);
}

/**
 * Most reliable on cloud: yt-dlp downloads (with cookies) and pipes into ffmpeg.
 */
function ffmpegFromYtdlpPipe(pageUrl, options = {}) {
  const af = buildAf(options);
  const bin = resolveYtdlpBin();

  const ytdlp = spawn(bin, ytdlpBaseArgs(pageUrl, ['-o', '-', '--no-warnings']), {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, PATH: `/usr/local/bin:${process.env.PATH || ''}` },
  });

  const ffmpegArgs = [
    '-analyzeduration', '0',
    '-loglevel', 'error',
    '-i', 'pipe:0',
  ];
  if (af) ffmpegArgs.push('-af', af);
  ffmpegArgs.push('-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1');

  const ffmpeg = spawn(ffmpegPath, ffmpegArgs, { stdio: ['pipe', 'pipe', 'pipe'] });

  ytdlp.stdout.pipe(ffmpeg.stdin);
  ytdlp.stdout.on('error', () => {});
  ffmpeg.stdin.on('error', () => {});

  let yErr = '';
  ytdlp.stderr.on('data', (c) => {
    yErr += c.toString();
    if (yErr.length > 2500) yErr = yErr.slice(-2500);
  });

  ytdlp.on('exit', (code) => {
    if (code && code !== 0) {
      logger.warn(`yt-dlp pipe exit ${code}: ${yErr.trim().slice(0, 300)}`);
    }
  });

  const cleanup = () => {
    try { ytdlp.kill('SIGKILL'); } catch { /* ignore */ }
    try { ffmpeg.kill('SIGKILL'); } catch { /* ignore */ }
  };

  return wrapFfmpegStdout(ffmpeg, cleanup).catch((err) => {
    cleanup();
    const extra = yErr.trim() ? ` | yt-dlp: ${yErr.trim().slice(-300)}` : '';
    throw new Error(`${err.message}${extra}`);
  });
}

async function streamWithYtdlp(pageUrl, options = {}) {
  // Prefer pipe (cookies applied by yt-dlp during download). URL+ffmpeg often hangs on Railway.
  try {
    logger.info('Trying yt-dlp → ffmpeg pipe');
    return await ffmpegFromYtdlpPipe(pageUrl, options);
  } catch (pipeErr) {
    logger.warn(`Pipe stream failed: ${pipeErr.message?.slice(0, 200)}`);
    try {
      const audioUrl = await resolveAudioUrl(pageUrl);
      logger.info('Falling back to direct URL + ffmpeg headers');
      return await ffmpegFromUrl(audioUrl, options);
    } catch (urlErr) {
      const detail = `${pipeErr.message}\n${urlErr.message}`;
      if (/sign in|not a bot|cookies/i.test(detail)) {
        throw new Error(
          'YouTube blocked this cloud server. Re-export cookies and set YOUTUBE_COOKIES_BASE64 on Railway.'
        );
      }
      throw new Error(`yt-dlp failed: ${detail.slice(-600)}`);
    }
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
