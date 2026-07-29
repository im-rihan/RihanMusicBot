const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('clear').setDescription('Clear all upcoming songs from the queue'),
  async execute(interaction) {
    const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
    if (!check.ok) return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });

    const ok = interaction.client.music.clear(interaction.guildId);
    if (!ok) return interaction.reply({ embeds: [errorEmbed('No active queue.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed('Cleared the queue.')] });
  },
};
