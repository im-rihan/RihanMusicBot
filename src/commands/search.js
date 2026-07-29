const { SlashCommandBuilder } = require('discord.js');
const { searchYouTube } = require('../player/trackResolver');
const { infoEmbed, errorEmbed, formatDuration } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('Search YouTube for songs without playing them')
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Song name to search').setRequired(true)
    ),
  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const query = interaction.options.getString('query', true);

    try {
      const results = await searchYouTube(query, interaction.user.id, 5);
      if (!results.length) {
        return interaction.editReply({ embeds: [errorEmbed('No results found.')] });
      }

      const lines = results
        .map((t, i) => `\`${i + 1}.\` [${t.title}](${t.url}) — \`${formatDuration(t.duration)}\``)
        .join('\n');

      return interaction.editReply({
        embeds: [
          infoEmbed('Search Results', `${lines}\n\nUse \`/play query:${query}\` to play the top result.`),
        ],
      });
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed(err.message || 'Search failed.')] });
    }
  },
};
