const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('shuffle').setDescription('Shuffle the queue'),
  async execute(interaction) {
    const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
    if (!check.ok) return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });

    const ok = interaction.client.music.shuffle(interaction.guildId);
    if (!ok) return interaction.reply({ embeds: [errorEmbed('Need at least 2 songs in the queue.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed('Queue shuffled.')] });
  },
};
