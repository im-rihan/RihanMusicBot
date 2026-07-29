const { SlashCommandBuilder } = require('discord.js');
const { queueEmbed, errorEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('Show the current music queue')
    .addIntegerOption((opt) =>
      opt.setName('page').setDescription('Page number').setMinValue(1)
    ),
  async execute(interaction) {
    const queue = interaction.client.music.get(interaction.guildId);
    if (!queue || queue.isEmpty) {
      return interaction.reply({ embeds: [errorEmbed('The queue is empty.')], ephemeral: true });
    }

    const page = interaction.options.getInteger('page') || 1;
    return interaction.reply({ embeds: [queueEmbed(queue, page)] });
  },
};
