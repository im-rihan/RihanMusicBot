const { MessageFlags } = require('discord.js');
const { canControlPlayer, checkVoiceRequirements } = require('../utils/permissions');
const { successEmbed, errorEmbed, queueEmbed, infoEmbed } = require('../utils/embeds');

const EPHEMERAL = { flags: MessageFlags.Ephemeral };

async function handleButton(interaction, client) {
  const id = interaction.customId;
  if (!id.startsWith('music_')) return;

  const check = checkVoiceRequirements(interaction, {
    needSameChannel: true,
    needDj: !['music_queue', 'music_lyrics'].includes(id),
  });
  if (!check.ok) {
    return interaction.reply({ embeds: [errorEmbed(check.message)], ...EPHEMERAL });
  }

  const queue = client.music.get(interaction.guildId);
  const needsTrack = !['music_stop', 'music_disconnect', 'music_queue'].includes(id);
  if (needsTrack && !queue?.current) {
    return interaction.reply({ embeds: [errorEmbed('Nothing is playing right now.')], ...EPHEMERAL });
  }

  switch (id) {
    case 'music_previous': {
      const track = await client.music.previous(interaction.guildId);
      return interaction.reply({
        embeds: [track ? successEmbed(`Playing previous: **${track.title}**`) : errorEmbed('No previous track.')],
        ...EPHEMERAL,
      });
    }
    case 'music_pause': {
      const ok = client.music.pause(interaction.guildId);
      return interaction.reply({
        embeds: [ok ? successEmbed('Paused.') : errorEmbed('Could not pause.')],
        ...EPHEMERAL,
      });
    }
    case 'music_resume': {
      const ok = client.music.resume(interaction.guildId);
      return interaction.reply({
        embeds: [ok ? successEmbed('Resumed.') : errorEmbed('Could not resume.')],
        ...EPHEMERAL,
      });
    }
    case 'music_skip': {
      const skipped = await client.music.skip(interaction.guildId);
      return interaction.reply({
        embeds: [skipped ? successEmbed(`Skipped **${skipped.title}**.`) : errorEmbed('Nothing to skip.')],
        ...EPHEMERAL,
      });
    }
    case 'music_stop': {
      if (!canControlPlayer(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Only DJs or admins can stop playback.')], ...EPHEMERAL });
      }
      client.music.stop(interaction.guildId);
      return interaction.reply({ embeds: [successEmbed('Stopped playback and cleared the queue.')], ...EPHEMERAL });
    }
    case 'music_loop': {
      const mode = client.music.cycleLoop(interaction.guildId);
      return interaction.reply({ embeds: [successEmbed(`Loop mode set to **${mode}**.`)], ...EPHEMERAL });
    }
    case 'music_shuffle': {
      const ok = client.music.shuffle(interaction.guildId);
      return interaction.reply({
        embeds: [ok ? successEmbed('Queue shuffled.') : errorEmbed('Need at least 2 songs in the queue.')],
        ...EPHEMERAL,
      });
    }
    case 'music_vol_down': {
      const q = client.music.get(interaction.guildId);
      const volume = client.music.setVolume(interaction.guildId, Math.max(0, (q?.volume ?? 50) - 10));
      return interaction.reply({
        embeds: [successEmbed(`Volume: **${volume}%** (applies on the next track).`)],
        ...EPHEMERAL,
      });
    }
    case 'music_vol_up': {
      const q = client.music.get(interaction.guildId);
      const volume = client.music.setVolume(interaction.guildId, Math.min(100, (q?.volume ?? 50) + 10));
      return interaction.reply({
        embeds: [successEmbed(`Volume: **${volume}%** (applies on the next track).`)],
        ...EPHEMERAL,
      });
    }
    case 'music_queue': {
      const q = client.music.get(interaction.guildId);
      if (!q || q.isEmpty) {
        return interaction.reply({ embeds: [errorEmbed('The queue is empty.')], ...EPHEMERAL });
      }
      return interaction.reply({ embeds: [queueEmbed(q, 1, 10, client)], ...EPHEMERAL });
    }
    case 'music_autoplay': {
      const q = client.music.ensure(interaction.guildId);
      q.autoplay = !q.autoplay;
      return interaction.reply({
        embeds: [successEmbed(`Autoplay is now **${q.autoplay ? 'on' : 'off'}**.`)],
        ...EPHEMERAL,
      });
    }
    case 'music_replay': {
      const track = await client.music.replay(interaction.guildId);
      return interaction.reply({
        embeds: [track ? successEmbed(`Replaying **${track.title}**.`) : errorEmbed('Nothing to replay.')],
        ...EPHEMERAL,
      });
    }
    case 'music_clear': {
      const ok = client.music.clear(interaction.guildId);
      return interaction.reply({
        embeds: [ok ? successEmbed('Cleared upcoming songs.') : errorEmbed('No active queue.')],
        ...EPHEMERAL,
      });
    }
    case 'music_lyrics': {
      const title = queue?.current?.title;
      if (!title) {
        return interaction.reply({ embeds: [errorEmbed('Nothing is playing.')], ...EPHEMERAL });
      }
      const q = encodeURIComponent(title);
      return interaction.reply({
        embeds: [
          infoEmbed(
            'Lyrics',
            `**${title}**\n[Genius](https://genius.com/search?q=${q}) · [Google](https://www.google.com/search?q=${q}+lyrics)`
          ),
        ],
        ...EPHEMERAL,
      });
    }
    case 'music_disconnect': {
      if (!canControlPlayer(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Only DJs or admins can disconnect the bot.')], ...EPHEMERAL });
      }
      client.music.destroy(interaction.guildId);
      return interaction.reply({ embeds: [successEmbed('Disconnected from the voice channel.')], ...EPHEMERAL });
    }
    default:
      return interaction.reply({ embeds: [errorEmbed('Unknown button.')], ...EPHEMERAL });
  }
}

module.exports = { handleButton };
