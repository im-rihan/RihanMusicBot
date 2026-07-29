const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { errorEmbed, successEmbed, trackEmbed, playerButtons, formatDuration } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a song from YouTube, Spotify, SoundCloud, or a search query')
    .addStringOption((opt) =>
      opt.setName('query').setDescription('Song name or URL').setRequired(true)
    ),
  async execute(interaction) {
    // Acknowledge immediately so Discord doesn't time out the interaction
    await interaction.deferReply();

    const check = checkVoiceRequirements(interaction, { needSameChannel: false });
    if (!check.ok) {
      return interaction.editReply({ embeds: [errorEmbed(check.message)] });
    }

    const query = interaction.options.getString('query', true);

    try {
      const result = await interaction.client.music.play(interaction, query);

      if (result.type === 'now') {
        const embed = trackEmbed(result.track, {
          title: result.added > 1 ? `Now Playing (+${result.added - 1} more)` : 'Now Playing',
        });
        return interaction.editReply({ embeds: [embed], components: playerButtons() });
      }

      if (result.added > 1) {
        return interaction.editReply({
          embeds: [
            successEmbed(
              `Added **${result.added}** tracks to the queue.\nFirst: [${result.track.title}](${result.track.url})`
            ),
          ],
        });
      }

      return interaction.editReply({
        embeds: [
          successEmbed(
            `Queued [${result.track.title}](${result.track.url}) — \`${formatDuration(result.track.duration)}\` at position **#${result.position}**`
          ),
        ],
      });
    } catch (err) {
      return interaction.editReply({ embeds: [errorEmbed(err.message || 'Failed to play.')] });
    }
  },
};
