const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue'),
  async execute(interaction) {
    const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
    if (!check.ok) return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });

    const ok = interaction.client.music.stop(interaction.guildId);
    if (!ok) return interaction.reply({ embeds: [errorEmbed('Nothing is playing.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed('Stopped playback and cleared the queue.')] });
  },
};
