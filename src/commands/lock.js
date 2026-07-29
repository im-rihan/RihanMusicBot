const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { updateGuildSettings } = require('../database');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Lock music commands to your current voice channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Only admins can lock the music channel.')], ephemeral: true });
    }

    const voice = interaction.member.voice?.channel;
    if (!voice) {
      return interaction.reply({ embeds: [errorEmbed('Join a voice channel to lock music to it.')], ephemeral: true });
    }

    updateGuildSettings(interaction.guildId, { locked_channel_id: voice.id });
    return interaction.reply({ embeds: [successEmbed(`Music locked to ${voice}.`)] });
  },
};
