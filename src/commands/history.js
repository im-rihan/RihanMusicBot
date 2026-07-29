const { SlashCommandBuilder } = require('discord.js');
const { getHistory } = require('../database');
const { infoEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('Show recently played songs in this server')
    .addIntegerOption((opt) =>
      opt.setName('limit').setDescription('How many songs to show (max 20)').setMinValue(1).setMaxValue(20)
    ),
  async execute(interaction) {
    const limit = interaction.options.getInteger('limit') || 10;
    const rows = getHistory(interaction.guildId, limit);

    if (!rows.length) {
      return interaction.reply({ embeds: [errorEmbed('No play history yet.')], ephemeral: true });
    }

    const lines = rows
      .map((r, i) => `\`${i + 1}.\` [${r.title}](${r.url}) — <@${r.requested_by}>`)
      .join('\n');

    return interaction.reply({
      embeds: [infoEmbed('Play History', lines)],
      ephemeral: true,
    });
  },
};
