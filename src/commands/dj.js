const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { updateGuildSettings } = require('../database');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dj')
    .setDescription('Set or clear the DJ role')
    .addRoleOption((opt) => opt.setName('role').setDescription('DJ role (omit to clear)'))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Only admins can manage the DJ role.')], ephemeral: true });
    }

    const role = interaction.options.getRole('role');

    if (!role) {
      updateGuildSettings(interaction.guildId, { dj_role_id: null });
      return interaction.reply({ embeds: [successEmbed('DJ role cleared. Everyone can control the player.')] });
    }

    updateGuildSettings(interaction.guildId, { dj_role_id: role.id });
    return interaction.reply({ embeds: [successEmbed(`DJ role set to ${role}.`)] });
  },
};
