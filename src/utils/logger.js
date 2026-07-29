const levels = ['debug', 'info', 'warn', 'error'];

function stamp() {
  return new Date().toISOString();
}

function createLogger(scope = 'bot') {
  const log = (level, ...args) => {
    if (!levels.includes(level)) level = 'info';
    const prefix = `[${stamp()}] [${level.toUpperCase()}] [${scope}]`;
    // eslint-disable-next-line no-console
    console[level === 'debug' ? 'log' : level](prefix, ...args);
  };

  return {
    debug: (...args) => log('debug', ...args),
    info: (...args) => log('info', ...args),
    warn: (...args) => log('warn', ...args),
    error: (...args) => log('error', ...args),
  };
}

module.exports = { createLogger };
