const { SlashCommandBuilder } = require('discord.js');
const { errorEmbed, infoEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('Show a lyrics search link for the current (or given) song')
    .addStringOption((opt) => opt.setName('song').setDescription('Song title (optional)')),
  async execute(interaction) {
    const queue = interaction.client.music.get(interaction.guildId);
    const custom = interaction.options.getString('song');
    const title = custom || queue?.current?.title;

    if (!title) {
      return interaction.reply({
        embeds: [errorEmbed('Nothing is playing. Provide a song name, or play something first.')],
        ephemeral: true,
      });
    }

    const q = encodeURIComponent(title);
    const embed = infoEmbed(
      'Lyrics',
      [
        `**Song:** ${title}`,
        '',
        `[Search on Genius](https://genius.com/search?q=${q})`,
        `[Search on Google](https://www.google.com/search?q=${q}+lyrics)`,
      ].join('\n')
    );

    return interaction.reply({ embeds: [embed] });
  },
};
