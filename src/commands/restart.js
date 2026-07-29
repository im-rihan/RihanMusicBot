const { SlashCommandBuilder } = require('discord.js');
const { isOwner } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');
const { createLogger } = require('../utils/logger');

const logger = createLogger('restart');

module.exports = {
  data: new SlashCommandBuilder().setName('restart').setDescription('Restart the bot process (owner only)'),
  async execute(interaction) {
    if (!isOwner(interaction.user.id)) {
      return interaction.reply({ embeds: [errorEmbed('Only the bot owner can restart.')], ephemeral: true });
    }

    await interaction.reply({ embeds: [successEmbed('Restarting…')] });
    logger.info(`Restart requested by ${interaction.user.tag}`);
    setTimeout(() => process.exit(0), 1000);
  },
};
