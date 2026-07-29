const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('Change the player volume')
    .addIntegerOption((opt) =>
      opt.setName('level').setDescription('Volume 0-100').setRequired(true).setMinValue(0).setMaxValue(100)
    ),
  async execute(interaction) {
    const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
    if (!check.ok) return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });

    const level = interaction.options.getInteger('level', true);
    const volume = interaction.client.music.setVolume(interaction.guildId, level);
    if (volume === null) return interaction.reply({ embeds: [errorEmbed('No active player.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`Volume set to **${volume}%**.`)] });
  },
};
