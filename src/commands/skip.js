const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('skip').setDescription('Skip the current track'),
  async execute(interaction) {
    const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
    if (!check.ok) return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });

    const skipped = await interaction.client.music.skip(interaction.guildId);
    if (!skipped) return interaction.reply({ embeds: [errorEmbed('Nothing to skip.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`Skipped **${skipped.title}**.`)] });
  },
};
