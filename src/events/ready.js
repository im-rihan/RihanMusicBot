const { ActivityType, Events } = require('discord.js');
const { createLogger } = require('../utils/logger');

const logger = createLogger('ready');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);
    logger.info(`Process PID ${process.pid} — run only ONE bot instance (Railway or PC, not both)`);

    client.user.setPresence({
      activities: [{ name: '/play | Rihan Music', type: ActivityType.Listening }],
      status: 'online',
    });
  },
};
