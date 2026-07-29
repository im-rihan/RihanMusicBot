const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { updateGuildSettings } = require('../database');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Unlock music so it can be used in any voice channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Only admins can unlock music.')], ephemeral: true });
    }

    updateGuildSettings(interaction.guildId, { locked_channel_id: null });
    return interaction.reply({ embeds: [successEmbed('Music unlocked for all voice channels.')] });
  },
};
