const fs = require('fs');
const path = require('path');
const { createLogger } = require('./logger');

const logger = createLogger('cookies');

let cachedPath = null;

/**
 * Netscape cookies need TAB separators. Railway/env pastes often turn tabs into spaces.
 * Format: domain, includeSubdomains, path, secure, expiry, name, value
 */
function normalizeNetscapeCookies(content) {
  return content
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => {
      const raw = line.trimEnd();
      if (!raw.trim() || raw.trim().startsWith('#')) return raw.trim();

      let parts;
      if (raw.includes('\t')) {
        parts = raw.split('\t');
      } else {
        // Space-separated fallback (value may contain spaces → keep rest joined)
        parts = raw.trim().split(/ +/);
      }

      if (parts.length < 7) return raw;

      const domain = parts[0];
      const flag = parts[1];
      const cookiePath = parts[2];
      const secure = parts[3];
      const expiry = parts[4];
      const name = parts[5];
      const value = parts.slice(6).join(raw.includes('\t') ? '\t' : ' ');

      return [domain, flag, cookiePath, secure, expiry, name, value].join('\t');
    })
    .join('\n');
}

function getCookiesPath() {
  if (cachedPath && fs.existsSync(cachedPath)) return cachedPath;

  if (process.env.COOKIES_PATH) {
    const p = path.isAbsolute(process.env.COOKIES_PATH)
      ? process.env.COOKIES_PATH
      : path.join(process.cwd(), process.env.COOKIES_PATH);
    if (fs.existsSync(p)) {
      // Also normalize files in case they were mangled
      const normalized = normalizeNetscapeCookies(fs.readFileSync(p, 'utf8'));
      const outDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const out = path.join(outDir, 'youtube-cookies.txt');
      fs.writeFileSync(out, normalized, 'utf8');
      cachedPath = out;
      logger.info(`Using cookies from COOKIES_PATH → ${out}`);
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

  const lines = normalized.split('\n').filter((l) => l && !l.startsWith('#') && l.includes('\t')).length;
  logger.info(`Wrote YouTube cookies for yt-dlp (${lines} cookie line(s), tab-normalized)`);
  return cachedPath;
}

module.exports = { getCookiesPath, normalizeNetscapeCookies };
