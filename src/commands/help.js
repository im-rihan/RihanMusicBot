const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { infoEmbed } = require('../utils/embeds');
const branding = require('../branding');

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('Show all bot commands'),
  async execute(interaction) {
    const embed = infoEmbed(
      'Rihan Music — Help',
      [
        branding.tagline,
        '',
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
        'Use the Now Playing buttons for quick controls.',
        '',
        `[GitHub](${branding.github})`,
      ].join('\n'),
      interaction.client
    );

    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};
