const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config');

function applyBotBrand(embed, client) {
  if (!client?.user) return embed;
  return embed.setAuthor({
    name: client.user.displayName || client.user.username,
    iconURL: client.user.displayAvatarURL({ size: 256 }),
  });
}

function baseEmbed(title, description, client = null) {
  const embed = new EmbedBuilder().setColor(config.embedColor).setTimestamp();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  return applyBotBrand(embed, client);
}

function successEmbed(description, client = null) {
  return baseEmbed(null, description, client).setColor(0x57f287);
}

function errorEmbed(description, client = null) {
  return baseEmbed('Error', description, client).setColor(0xed4245);
}

function infoEmbed(title, description, client = null) {
  return baseEmbed(title, description, client);
}

function formatDuration(ms) {
  if (!ms || ms < 0 || !Number.isFinite(ms)) return 'Live';
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function progressBar(current, total, size = config.progressBarLength) {
  if (!total || total <= 0) return '▬'.repeat(size);
  const ratio = Math.min(1, Math.max(0, current / total));
  const filled = Math.round(size * ratio);
  const empty = size - filled;
  return `${'▬'.repeat(Math.max(0, filled - 1))}🔘${'▬'.repeat(Math.max(0, empty))}`;
}

function trackEmbed(track, options = {}) {
  const embed = baseEmbed(options.title || 'Now Playing', null, options.client)
    .setDescription(`[${track.title}](${track.url})`)
    .addFields(
      { name: 'Duration', value: formatDuration(track.duration), inline: true },
      { name: 'Requested by', value: track.requestedBy ? `<@${track.requestedBy}>` : 'Unknown', inline: true },
      { name: 'Source', value: track.source || 'YouTube', inline: true }
    );

  if (track.thumbnail) embed.setThumbnail(track.thumbnail);
  if (options.client?.user) {
    embed.setFooter({
      text: options.footer || 'Rihan Music',
      iconURL: options.client.user.displayAvatarURL({ size: 128 }),
    });
  } else if (options.footer) {
    embed.setFooter({ text: options.footer });
  }
  if (typeof options.position === 'number' && track.duration) {
    embed.addFields({
      name: 'Progress',
      value: `${progressBar(options.position, track.duration)} \`${formatDuration(options.position)} / ${formatDuration(track.duration)}\``,
    });
  }
  return embed;
}

function queueEmbed(queue, page = 1, pageSize = 10, client = null) {
  const tracks = queue.tracks;
  const totalPages = Math.max(1, Math.ceil(tracks.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const slice = tracks.slice(start, start + pageSize);

  let description = '';
  if (queue.current) {
    description += `**Now Playing:**\n[${queue.current.title}](${queue.current.url}) — \`${formatDuration(queue.current.duration)}\`\n\n`;
  }

  if (slice.length === 0) {
    description += '*Queue is empty.*';
  } else {
    description += '**Up Next:**\n';
    description += slice
      .map((t, i) => `\`${start + i + 1}.\` [${t.title}](${t.url}) — \`${formatDuration(t.duration)}\` — <@${t.requestedBy}>`)
      .join('\n');
  }

  const embed = baseEmbed('Music Queue', description, client);
  const footer = {
    text: `Page ${safePage}/${totalPages} • ${tracks.length} song(s) • Volume: ${queue.volume}% • Loop: ${queue.loopMode}`,
  };
  if (client?.user) footer.iconURL = client.user.displayAvatarURL({ size: 128 });
  return embed.setFooter(footer);
}

function playerButtons(disabled = false) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_previous').setLabel('Prev').setStyle(ButtonStyle.Secondary).setEmoji('⏮️').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_pause').setLabel('Pause').setStyle(ButtonStyle.Secondary).setEmoji('⏸️').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_resume').setLabel('Resume').setStyle(ButtonStyle.Success).setEmoji('▶️').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_skip').setLabel('Next').setStyle(ButtonStyle.Primary).setEmoji('⏭️').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_stop').setLabel('Stop').setStyle(ButtonStyle.Danger).setEmoji('⏹️').setDisabled(disabled)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_loop').setLabel('Loop').setStyle(ButtonStyle.Secondary).setEmoji('🔁').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_shuffle').setLabel('Shuffle').setStyle(ButtonStyle.Secondary).setEmoji('🔀').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_vol_down').setLabel('Vol -').setStyle(ButtonStyle.Secondary).setEmoji('🔉').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_vol_up').setLabel('Vol +').setStyle(ButtonStyle.Secondary).setEmoji('🔊').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_queue').setLabel('Queue').setStyle(ButtonStyle.Primary).setEmoji('📃').setDisabled(disabled)
  );

  const row3 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('music_autoplay').setLabel('Autoplay').setStyle(ButtonStyle.Secondary).setEmoji('🎶').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_replay').setLabel('Replay').setStyle(ButtonStyle.Secondary).setEmoji('🔄').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_clear').setLabel('Clear').setStyle(ButtonStyle.Secondary).setEmoji('🗑️').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_lyrics').setLabel('Lyrics').setStyle(ButtonStyle.Secondary).setEmoji('🎤').setDisabled(disabled),
    new ButtonBuilder().setCustomId('music_disconnect').setLabel('Leave').setStyle(ButtonStyle.Danger).setEmoji('🚪').setDisabled(disabled)
  );

  return [row1, row2, row3];
}

module.exports = {
  baseEmbed,
  successEmbed,
  errorEmbed,
  infoEmbed,
  formatDuration,
  progressBar,
  trackEmbed,
  queueEmbed,
  playerButtons,
};
