const { SlashCommandBuilder } = require('discord.js');
const { infoEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Show all bot commands'),
  async execute(interaction) {
    const embed = infoEmbed(
      'Rihan Music — Help',
      [
        '**Music**',
        '`/play` `/pause` `/resume` `/skip` `/stop`',
        '`/queue` `/nowplaying` `/loop` `/shuffle` `/volume`',
        '`/clear` `/remove` `/jump` `/disconnect`',
        '`/search` `/lyrics` `/autoplay` `/filter` `/history`',
        '',
        '**Admin**',
        '`/247` `/dj` `/lock` `/unlock` `/setup` `/restart`',
        '',
        'Supports **YouTube**, **Spotify** links, and **SoundCloud**.',
        'Use the Now Playing buttons: Prev / Pause / Resume / Next / Stop,',
        'Loop / Shuffle / Vol± / Queue / Autoplay / Replay / Clear / Lyrics / Leave.',
      ].join('\n')
    );

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
