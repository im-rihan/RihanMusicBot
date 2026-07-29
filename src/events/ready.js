const { ActivityType, Events } = require('discord.js');
const { createLogger } = require('../utils/logger');
const branding = require('../branding');

const logger = createLogger('ready');

module.exports = {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    logger.info(`Logged in as ${client.user.tag}`);
    logger.info(`Serving ${client.guilds.cache.size} guild(s)`);
    logger.info(`Process PID ${process.pid} — run only ONE bot instance (Railway or PC, not both)`);

    client.user.setPresence({
      activities: [{ name: branding.activity, type: ActivityType.Listening }],
      status: 'online',
    });

    try {
      await client.application.fetch();
      const payload = {
        description: branding.description.slice(0, 400),
      };
      // Tags are optional; Discord may reject invalid ones on some apps
      if (Array.isArray(branding.tags) && branding.tags.length) {
        payload.tags = branding.tags.slice(0, 5).map((t) => String(t).slice(0, 20));
      }
      await client.application.edit(payload);
      logger.info('Updated application description / tags (About Me)');
    } catch (err) {
      logger.warn(`Could not update application bio: ${err.message}`);
    }
  },
};
