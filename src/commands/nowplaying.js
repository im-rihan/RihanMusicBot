const { SlashCommandBuilder } = require('discord.js');
const { trackEmbed, errorEmbed, playerButtons } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('nowplaying').setDescription('Show the currently playing track'),
  async execute(interaction) {
    const queue = interaction.client.music.get(interaction.guildId);
    if (!queue?.current) {
      return interaction.reply({ embeds: [errorEmbed('Nothing is playing right now.')], ephemeral: true });
    }

    const embed = trackEmbed(queue.current, {
      title: 'Now Playing',
      position: queue.getPositionMs(),
      footer: `Volume: ${queue.volume}% • Loop: ${queue.loopMode}${queue.filters.bassboost ? ' • Bass Boost' : ''}`,
    });

    return interaction.reply({ embeds: [embed], components: playerButtons() });
  },
};
