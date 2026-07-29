const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a song from the queue by position')
    .addIntegerOption((opt) =>
      opt.setName('position').setDescription('Queue position (1 = next song)').setRequired(true).setMinValue(1)
    ),
  async execute(interaction) {
    const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
    if (!check.ok) return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });

    const position = interaction.options.getInteger('position', true);
    const removed = interaction.client.music.remove(interaction.guildId, position - 1);
    if (!removed) return interaction.reply({ embeds: [errorEmbed('Invalid queue position.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`Removed **${removed.title}** from the queue.`)] });
  },
};
