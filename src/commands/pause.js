const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('pause').setDescription('Pause the current track'),
  async execute(interaction) {
    const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
    if (!check.ok) return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });

    const ok = interaction.client.music.pause(interaction.guildId);
    if (!ok) return interaction.reply({ embeds: [errorEmbed('Nothing is playing or already paused.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed('Paused playback.')] });
  },
};
