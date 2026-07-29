const { MessageFlags } = require('discord.js');
const { errorEmbed } = require('../utils/embeds');
const { handleButton } = require('../buttons/musicButtons');
const { createLogger } = require('../utils/logger');

const logger = createLogger('interaction');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        await command.execute(interaction, client);
        return;
      }

      if (interaction.isButton()) {
        await handleButton(interaction, client);
      }
    } catch (err) {
      // Duplicate bot instances often cause 40060 / 10062 — ignore those
      if (err.code === 40060 || err.code === 10062) {
        logger.warn(`Ignored interaction race (${err.code}) for ${interaction.commandName || interaction.customId}`);
        return;
      }

      logger.error(`Interaction error (${interaction.commandName || interaction.customId}):`, err);
      const payload = {
        embeds: [errorEmbed(err.message || 'Something went wrong.', client)],
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  },
};
