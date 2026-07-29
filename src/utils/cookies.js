const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('cookies');

let cachedPath = null;

/**
 * Resolve a Netscape cookies.txt path for yt-dlp.
 * Supports:
 * - COOKIES_PATH=/absolute/or/relative/path/to/cookies.txt
 * - YOUTUBE_COOKIES=<raw netscape cookie file contents>
 * - YOUTUBE_COOKIES_BASE64=<base64 of that file>
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

  let content = process.env.YOUTUBE_COOKIES || null;
  if (!content && process.env.YOUTUBE_COOKIES_BASE64) {
    try {
      content = Buffer.from(process.env.YOUTUBE_COOKIES_BASE64, 'base64').toString('utf8');
    } catch (err) {
      logger.warn('Failed to decode YOUTUBE_COOKIES_BASE64:', err.message);
    }
  }

  if (!content || !content.trim()) return null;

  const outDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, 'youtube-cookies.txt');
  fs.writeFileSync(out, content.replace(/\\n/g, '\n'), 'utf8');
  cachedPath = out;
  logger.info('Wrote YouTube cookies for yt-dlp');
  return cachedPath;
}

module.exports = { getCookiesPath };
