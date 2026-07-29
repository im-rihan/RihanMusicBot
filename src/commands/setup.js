const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { updateGuildSettings, getGuildSettings } = require('../database');
const { errorEmbed, successEmbed, infoEmbed } = require('../utils/embeds');
const config = require('../config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('Configure default music settings for this server')
    .addChannelOption((opt) =>
      opt
        .setName('text_channel')
        .setDescription('Default text channel for Now Playing messages')
        .addChannelTypes(ChannelType.GuildText)
    )
    .addIntegerOption((opt) =>
      opt.setName('volume').setDescription('Default volume 0-100').setMinValue(0).setMaxValue(100)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Only admins can run setup.')], ephemeral: true });
    }

    const textChannel = interaction.options.getChannel('text_channel');
    const volume = interaction.options.getInteger('volume');

    const updates = {};
    if (textChannel) updates.text_channel_id = textChannel.id;
    if (volume !== null) updates.default_volume = volume;

    if (Object.keys(updates).length === 0) {
      const settings = getGuildSettings(interaction.guildId);
      return interaction.reply({
        embeds: [
          infoEmbed(
            'Server Settings',
            [
              `**DJ Role:** ${settings.dj_role_id ? `<@&${settings.dj_role_id}>` : 'None'}`,
              `**24/7:** ${settings.stay_247 ? 'On' : 'Off'}`,
              `**Locked VC:** ${settings.locked_channel_id ? `<#${settings.locked_channel_id}>` : 'None'}`,
              `**Default Volume:** ${settings.default_volume ?? config.defaultVolume}%`,
              `**Text Channel:** ${settings.text_channel_id ? `<#${settings.text_channel_id}>` : 'Auto'}`,
            ].join('\n')
          ),
        ],
        ephemeral: true,
      });
    }

    updateGuildSettings(interaction.guildId, updates);
    return interaction.reply({ embeds: [successEmbed('Server music settings updated.')] });
  },
};
