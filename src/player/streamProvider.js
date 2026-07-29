const { spawn } = require('child_process');
const { StreamType } = require('@discordjs/voice');
const ffmpegPath = require('ffmpeg-static');
const play = require('play-dl');
const { createLogger } = require('../utils/logger');
const { YOUTUBE_DL_PATH } = require('youtube-dl-exec/src/constants');
const logger = createLogger('stream');

function buildAf({ volume = 100, filterAf = null } = {}) {
  const parts = [];
  if (filterAf) parts.push(filterAf);
  if (volume !== 100) {
    const vol = Math.max(0.01, Math.min(2, volume / 100));
    parts.push(`volume=${vol}`);
  }
  return parts.length ? parts.join(',') : null;
}

/**
 * Stream YouTube (and most sites) via yt-dlp piped into FFmpeg.
 * More reliable than play-dl / direct googlevideo URLs.
 */
function streamWithYtdlp(pageUrl, options = {}) {
  const af = buildAf(options);
  const ytdlp = spawn(YOUTUBE_DL_PATH, [
    pageUrl,
    '-f', 'bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio/best',
    '-o', '-',
    '--no-warnings',
    '--quiet',
    '--no-playlist',
    '--no-check-certificates',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });

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
  ytdlp.stderr.on('data', (c) => {
    yErr += c.toString();
    if (yErr.length > 1500) yErr = yErr.slice(-1500);
  });
  ffmpeg.stderr.on('data', (c) => {
    fErr += c.toString();
    if (fErr.length > 1500) fErr = fErr.slice(-1500);
  });

  ytdlp.on('exit', (code) => {
    if (code && code !== 0) {
      logger.warn(`yt-dlp exit ${code}: ${yErr.trim().slice(0, 250)}`);
      try { ffmpeg.kill('SIGKILL'); } catch { /* ignore */ }
    }
  });

  ffmpeg.on('exit', (code) => {
    if (code && code !== 0) {
      logger.warn(`ffmpeg exit ${code}: ${fErr.trim().slice(0, 250)}`);
    }
    try { ytdlp.kill('SIGKILL'); } catch { /* ignore */ }
  });

  const cleanup = () => {
    try { ytdlp.kill('SIGKILL'); } catch { /* ignore */ }
    try { ffmpeg.kill('SIGKILL'); } catch { /* ignore */ }
  };

  return {
    stream: ffmpeg.stdout,
    type: StreamType.Raw,
    process: { kill: cleanup, ytdlp, ffmpeg },
  };
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

  logger.info(`Streaming via yt-dlp pipe: ${track.title}`);
  return streamWithYtdlp(track.url, options);
}

module.exports = {
  createTrackStream,
};
