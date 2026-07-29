const LOOP_OFF = 'off';
const LOOP_TRACK = 'track';
const LOOP_QUEUE = 'queue';

class GuildQueue {
  constructor(guildId) {
    this.guildId = guildId;
    this.tracks = [];
    this.current = null;
    this.previous = null;
    this.history = [];
    this.volume = 50;
    this.loopMode = LOOP_OFF;
    this.autoplay = false;
    this.textChannelId = null;
    this.voiceChannelId = null;
    this.connection = null;
    this.player = null;
    this.resource = null;
    this.nowPlayingMessage = null;
    this.leaveTimeout = null;
    this.filters = {
      bassboost: false,
      eq: 'flat',
    };
    this.locked = false;
    this.startedAt = null;
  }

  get size() {
    return this.tracks.length;
  }

  get isEmpty() {
    return this.tracks.length === 0 && !this.current;
  }

  add(track) {
    this.tracks.push(track);
    return this.tracks.length;
  }

  addMany(tracks) {
    this.tracks.push(...tracks);
    return this.tracks.length;
  }

  next() {
    if (this.loopMode === LOOP_TRACK && this.current) {
      return this.current;
    }

    if (this.current) {
      this.previous = this.current;
      this.history.unshift(this.current);
      if (this.history.length > 50) this.history.pop();
    }

    if (this.loopMode === LOOP_QUEUE && this.current) {
      this.tracks.push(this.current);
    }

    this.current = this.tracks.shift() || null;
    this.startedAt = this.current ? Date.now() : null;
    return this.current;
  }

  skip() {
    return this.next();
  }

  remove(index) {
    if (index < 0 || index >= this.tracks.length) return null;
    return this.tracks.splice(index, 1)[0];
  }

  jump(index) {
    if (index < 0 || index >= this.tracks.length) return null;
    const track = this.tracks.splice(index, 1)[0];
    this.tracks.unshift(track);
    return track;
  }

  clear() {
    this.tracks = [];
  }

  shuffle() {
    for (let i = this.tracks.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
    }
  }

  setLoop(mode) {
    const allowed = [LOOP_OFF, LOOP_TRACK, LOOP_QUEUE];
    if (!allowed.includes(mode)) return this.loopMode;
    this.loopMode = mode;
    return this.loopMode;
  }

  cycleLoop() {
    const order = [LOOP_OFF, LOOP_TRACK, LOOP_QUEUE];
    const next = order[(order.indexOf(this.loopMode) + 1) % order.length];
    this.loopMode = next;
    return next;
  }

  getPositionMs() {
    if (!this.startedAt) return 0;
    return Date.now() - this.startedAt;
  }
}

module.exports = {
  GuildQueue,
  LOOP_OFF,
  LOOP_TRACK,
  LOOP_QUEUE,
};
