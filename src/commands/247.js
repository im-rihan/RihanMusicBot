const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { isAdmin } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('247')
    .setDescription('Toggle 24/7 mode — bot stays in the voice channel')
    .addBooleanOption((opt) =>
      opt.setName('enabled').setDescription('Enable or disable 24/7').setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    if (!isAdmin(interaction.member)) {
      return interaction.reply({ embeds: [errorEmbed('Only admins can toggle 24/7 mode.')], ephemeral: true });
    }

    const enabled = interaction.options.getBoolean('enabled', true);
    const voice = interaction.member.voice?.channel;

    if (enabled && !voice) {
      return interaction.reply({ embeds: [errorEmbed('Join a voice channel first to enable 24/7.')], ephemeral: true });
    }

    await interaction.client.music.stay247(
      interaction.guildId,
      enabled,
      voice,
      interaction.channelId
    );

    return interaction.reply({
      embeds: [
        successEmbed(
          enabled
            ? `24/7 mode **enabled**. I will stay in ${voice}.`
            : '24/7 mode **disabled**. I will leave when idle.'
        ),
      ],
    });
  },
};
