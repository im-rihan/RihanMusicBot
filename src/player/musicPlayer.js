const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  getVoiceConnection,
  StreamType,
} = require('@discordjs/voice');
const play = require('play-dl');
const { GuildQueue } = require('./queueManager');
const { getFilterArgs } = require('./filters');
const { resolveQuery, searchRelated } = require('./trackResolver');
const { trackEmbed, playerButtons, errorEmbed } = require('../utils/embeds');
const { getGuildSettings, updateGuildSettings, addToHistory } = require('../database');
const config = require('../config');
const { createLogger } = require('../utils/logger');

const logger = createLogger('player');

class MusicPlayer {
  constructor(client) {
    this.client = client;
    this.queues = new Map();
  }

  get(guildId) {
    return this.queues.get(guildId) || null;
  }

  ensure(guildId) {
    if (!this.queues.has(guildId)) {
      const queue = new GuildQueue(guildId);
      const settings = getGuildSettings(guildId);
      queue.volume = settings.default_volume ?? config.defaultVolume;
      this.queues.set(guildId, queue);
    }
    return this.queues.get(guildId);
  }

  async connect(interaction, voiceChannel) {
    const queue = this.ensure(interaction.guildId);
    queue.textChannelId = interaction.channelId;
    queue.voiceChannelId = voiceChannel.id;

    if (queue.connection && queue.player) {
      return queue;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: interaction.guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    queue.connection = connection;
    queue.player = player;

    player.on(AudioPlayerStatus.Idle, () => {
      this.handleTrackEnd(interaction.guildId).catch((err) => {
        logger.error('Track end handler failed:', err);
      });
    });

    player.on('error', (err) => {
      logger.error(`Player error in guild ${interaction.guildId}:`, err.message);
      this.handleTrackEnd(interaction.guildId).catch(() => {});
    });

    connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        const settings = getGuildSettings(interaction.guildId);
        if (!settings.stay_247) {
          this.destroy(interaction.guildId);
        }
      }
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (err) {
      this.destroy(interaction.guildId);
      throw new Error('Failed to join the voice channel in time.');
    }

    return queue;
  }

  async play(interaction, query) {
    const voiceChannel = interaction.member.voice.channel;
    if (!voiceChannel) throw new Error('Join a voice channel first.');

    const tracks = await resolveQuery(query, interaction.user.id);
    if (!tracks.length) throw new Error('No results found for that query.');

    if (tracks.length > config.maxQueueSize) {
      tracks.length = config.maxQueueSize;
    }

    const queue = await this.connect(interaction, voiceChannel);
    this.clearLeaveTimeout(queue);

    const wasIdle = !queue.current;
    queue.addMany(tracks);

    if (wasIdle) {
      await this.processQueue(interaction.guildId);
      return {
        type: 'now',
        track: queue.current,
        added: tracks.length,
      };
    }

    return {
      type: 'queued',
      track: tracks[0],
      added: tracks.length,
      position: queue.size - tracks.length + 1,
    };
  }

  async processQueue(guildId) {
    const queue = this.get(guildId);
    if (!queue) return;

    const track = queue.next();
    if (!track) {
      if (queue.autoplay && queue.previous) {
        const related = await searchRelated(queue.previous);
        if (related) {
          queue.add(related);
          return this.processQueue(guildId);
        }
      }

      const settings = getGuildSettings(guildId);
      if (!settings.stay_247) {
        this.scheduleLeave(guildId);
      }
      return;
    }

    try {
      await this.playTrack(guildId, track);
    } catch (err) {
      logger.error(`Failed to play track ${track.title}:`, err.message);
      const channel = await this.getTextChannel(guildId);
      if (channel) {
        await channel.send({ embeds: [errorEmbed(`Could not play **${track.title}**. Skipping…`)] }).catch(() => {});
      }
      await this.processQueue(guildId);
    }
  }

  async playTrack(guildId, track) {
    const queue = this.get(guildId);
    if (!queue?.player) throw new Error('No active player.');

    const stream = track.source === 'SoundCloud'
      ? await play.stream(track.url, { quality: 2 })
      : await play.stream(track.url);

    const filterArgs = getFilterArgs(queue);
    let input = stream.stream;
    let inputType = stream.type || StreamType.Arbitrary;

    if (filterArgs.length) {
      const { spawn } = require('child_process');
      const ffmpegPath = require('ffmpeg-static');
      const ffmpeg = spawn(ffmpegPath, [
        '-analyzeduration', '0',
        '-loglevel', '0',
        '-i', 'pipe:0',
        ...filterArgs,
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2',
        'pipe:1',
      ], { stdio: ['pipe', 'pipe', 'ignore'] });

      stream.stream.pipe(ffmpeg.stdin);
      stream.stream.on('error', () => {
        try { ffmpeg.kill('SIGKILL'); } catch { /* ignore */ }
      });
      ffmpeg.stdin.on('error', () => {});
      input = ffmpeg.stdout;
      inputType = StreamType.Raw;
    }

    const resource = createAudioResource(input, {
      inputType,
      inlineVolume: true,
    });

    resource.volume?.setVolume(queue.volume / 100);
    queue.resource = resource;
    queue.startedAt = Date.now();
    queue.player.play(resource);

    addToHistory(guildId, track.title, track.url, track.requestedBy);
    await this.sendNowPlaying(guildId, track);
  }

  async sendNowPlaying(guildId, track) {
    const channel = await this.getTextChannel(guildId);
    if (!channel) return;

    const embed = trackEmbed(track, { title: 'Now Playing' });
    const message = await channel.send({
      embeds: [embed],
      components: [playerButtons()],
    }).catch(() => null);

    if (message) queueSafeSetNowPlaying(this.get(guildId), message);
  }

  async handleTrackEnd(guildId) {
    const queue = this.get(guildId);
    if (!queue) return;
    await this.processQueue(guildId);
  }

  pause(guildId) {
    const queue = this.get(guildId);
    if (!queue?.player) return false;
    return queue.player.pause(true);
  }

  resume(guildId) {
    const queue = this.get(guildId);
    if (!queue?.player) return false;
    return queue.player.unpause();
  }

  async skip(guildId) {
    const queue = this.get(guildId);
    if (!queue?.player || !queue.current) return null;
    const skipped = queue.current;
    queue.player.stop(true);
    return skipped;
  }

  stop(guildId) {
    const queue = this.get(guildId);
    if (!queue) return false;
    queue.clear();
    queue.current = null;
    queue.loopMode = 'off';
    queue.autoplay = false;
    queue.player?.stop(true);
    const settings = getGuildSettings(guildId);
    if (!settings.stay_247) {
      this.destroy(guildId);
    }
    return true;
  }

  setVolume(guildId, volume) {
    const queue = this.get(guildId);
    if (!queue) return null;
    queue.volume = Math.min(100, Math.max(0, volume));
    queue.resource?.volume?.setVolume(queue.volume / 100);
    updateGuildSettings(guildId, { default_volume: queue.volume });
    return queue.volume;
  }

  shuffle(guildId) {
    const queue = this.get(guildId);
    if (!queue || queue.size < 2) return false;
    queue.shuffle();
    return true;
  }

  setLoop(guildId, mode) {
    const queue = this.get(guildId);
    if (!queue) return null;
    return queue.setLoop(mode);
  }

  cycleLoop(guildId) {
    const queue = this.get(guildId);
    if (!queue) return null;
    return queue.cycleLoop();
  }

  clear(guildId) {
    const queue = this.get(guildId);
    if (!queue) return false;
    queue.clear();
    return true;
  }

  remove(guildId, index) {
    const queue = this.get(guildId);
    if (!queue) return null;
    return queue.remove(index);
  }

  jump(guildId, index) {
    const queue = this.get(guildId);
    if (!queue) return null;
    const track = queue.jump(index);
    if (track) queue.player?.stop(true);
    return track;
  }

  setBassBoost(guildId, enabled) {
    const queue = this.get(guildId);
    if (!queue) return null;
    queue.filters.bassboost = Boolean(enabled);
    return queue.filters.bassboost;
  }

  setEq(guildId, preset) {
    const queue = this.get(guildId);
    if (!queue) return null;
    queue.filters.eq = preset;
    queue.filters.bassboost = false;
    return queue.filters.eq;
  }

  async getTextChannel(guildId) {
    const queue = this.get(guildId);
    if (!queue?.textChannelId) return null;
    try {
      return await this.client.channels.fetch(queue.textChannelId);
    } catch {
      return null;
    }
  }

  scheduleLeave(guildId) {
    const queue = this.get(guildId);
    if (!queue) return;
    this.clearLeaveTimeout(queue);
    queue.leaveTimeout = setTimeout(() => {
      const settings = getGuildSettings(guildId);
      if (settings.stay_247) return;
      this.destroy(guildId);
    }, config.leaveOnEndCooldown);
  }

  clearLeaveTimeout(queue) {
    if (queue.leaveTimeout) {
      clearTimeout(queue.leaveTimeout);
      queue.leaveTimeout = null;
    }
  }

  destroy(guildId) {
    const queue = this.get(guildId);
    if (!queue) return;
    this.clearLeaveTimeout(queue);
    try {
      queue.player?.stop(true);
      queue.connection?.destroy();
    } catch {
      // ignore
    }
    const existing = getVoiceConnection(guildId);
    if (existing) {
      try {
        existing.destroy();
      } catch {
        // ignore
      }
    }
    this.queues.delete(guildId);
  }

  async stay247(guildId, enabled, voiceChannel, textChannelId) {
    updateGuildSettings(guildId, {
      stay_247: enabled,
      voice_channel_id: voiceChannel?.id || null,
      text_channel_id: textChannelId || null,
    });

    if (!enabled) return { enabled: false };

    const queue = this.ensure(guildId);
    queue.textChannelId = textChannelId;
    queue.voiceChannelId = voiceChannel.id;
    this.clearLeaveTimeout(queue);

    if (!queue.connection) {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });
      const player = createAudioPlayer();
      connection.subscribe(player);
      queue.connection = connection;
      queue.player = player;

      player.on(AudioPlayerStatus.Idle, () => {
        this.handleTrackEnd(guildId).catch(() => {});
      });
    }

    return { enabled: true };
  }
}

function queueSafeSetNowPlaying(queue, message) {
  if (queue) queue.nowPlayingMessage = message;
}

module.exports = { MusicPlayer };
