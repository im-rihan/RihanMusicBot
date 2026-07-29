const { getGuildSettings } = require('../database');
const { createLogger } = require('../utils/logger');

const logger = createLogger('voice');

module.exports = {
  name: 'voiceStateUpdate',
  async execute(oldState, newState, client) {
    const guildId = oldState.guild.id;
    const queue = client.music.get(guildId);
    if (!queue?.voiceChannelId) return;

    // Bot was disconnected manually
    if (oldState.id === client.user.id && !newState.channelId) {
      const settings = getGuildSettings(guildId);
      if (!settings.stay_247) {
        client.music.destroy(guildId);
        logger.info(`Destroyed queue for ${guildId} after bot disconnect`);
      }
      return;
    }

    const channel = oldState.guild.channels.cache.get(queue.voiceChannelId);
    if (!channel) return;

    const humans = channel.members.filter((m) => !m.user.bot);
    const settings = getGuildSettings(guildId);

    if (humans.size === 0 && !settings.stay_247) {
      if (!queue.leaveTimeout) {
        queue.leaveTimeout = setTimeout(() => {
          const stillEmpty = channel.members.filter((m) => !m.user.bot).size === 0;
          if (stillEmpty) {
            client.music.destroy(guildId);
            logger.info(`Left empty voice channel in ${guildId}`);
          }
        }, require('../config').leaveOnEmptyCooldown);
      }
    } else if (humans.size > 0) {
      client.music.clearLeaveTimeout(queue);
    }
  },
};
