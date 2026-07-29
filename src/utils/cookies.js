const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('cookies');

let cachedPath = null;

/**
 * Railway/env pastes often turn tabs into spaces. Netscape cookies need tabs.
 */
function normalizeNetscapeCookies(content) {
  return content
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const trimmed = line.trimEnd();
      if (!trimmed || trimmed.startsWith('#')) return trimmed;
      if (trimmed.includes('\t')) return trimmed;
      // Convert 2+ spaces between fields into tabs (best-effort)
      return trimmed.replace(/ {2,}/g, '\t');
    })
    .join('\n');
}

/**
 * Resolve a Netscape cookies.txt path for yt-dlp.
 * Supports:
 * - COOKIES_PATH=/absolute/or/relative/path/to/cookies.txt
 * - YOUTUBE_COOKIES=<raw netscape cookie file contents>
 * - YOUTUBE_COOKIES_BASE64=<base64 of that file>  (preferred on Railway)
 */
function getCookiesPath() {
  if (cachedPath && fs.existsSync(cachedPath)) return cachedPath;

  if (process.env.COOKIES_PATH) {
    const p = path.isAbsolute(process.env.COOKIES_PATH)
      ? process.env.COOKIES_PATH
      : path.join(process.cwd(), process.env.COOKIES_PATH);
    if (fs.existsSync(p)) {
      cachedPath = p;
      logger.info(`Using cookies file at ${p}`);
      return cachedPath;
    }
    logger.warn(`COOKIES_PATH set but file missing: ${p}`);
  }

  let content = null;
  if (process.env.YOUTUBE_COOKIES_BASE64) {
    try {
      content = Buffer.from(process.env.YOUTUBE_COOKIES_BASE64, 'base64').toString('utf8');
      logger.info('Decoded YOUTUBE_COOKIES_BASE64');
    } catch (err) {
      logger.warn('Failed to decode YOUTUBE_COOKIES_BASE64:', err.message);
    }
  }
  if (!content && process.env.YOUTUBE_COOKIES) {
    content = process.env.YOUTUBE_COOKIES;
  }

  if (!content || !content.trim()) return null;

  const normalized = normalizeNetscapeCookies(content);
  const outDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'youtube-cookies.txt');
  fs.writeFileSync(out, normalized, 'utf8');
  cachedPath = out;

  const lines = normalized.split('\n').filter((l) => l && !l.startsWith('#')).length;
  logger.info(`Wrote YouTube cookies for yt-dlp (${lines} cookie line(s))`);
  return cachedPath;
}

module.exports = { getCookiesPath };
