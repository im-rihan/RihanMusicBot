const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('jump')
    .setDescription('Jump to a specific song in the queue')
    .addIntegerOption((opt) =>
      opt.setName('position').setDescription('Queue position to jump to').setRequired(true).setMinValue(1)
    ),
  async execute(interaction) {
    const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
    if (!check.ok) return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });

    const position = interaction.options.getInteger('position', true);
    const track = interaction.client.music.jump(interaction.guildId, position - 1);
    if (!track) return interaction.reply({ embeds: [errorEmbed('Invalid queue position.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`Jumping to **${track.title}**.`)] });
  },
};
