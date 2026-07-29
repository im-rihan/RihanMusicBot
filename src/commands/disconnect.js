const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('disconnect').setDescription('Disconnect the bot from the voice channel'),
  async execute(interaction) {
    const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
    if (!check.ok) return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });

    const queue = interaction.client.music.get(interaction.guildId);
    if (!queue) return interaction.reply({ embeds: [errorEmbed('I am not connected to a voice channel.')], ephemeral: true });

    interaction.client.music.destroy(interaction.guildId);
    return interaction.reply({ embeds: [successEmbed('Disconnected from the voice channel.')] });
  },
};
