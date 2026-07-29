const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '..', 'data');
const dbPath = path.join(dataDir, 'bot.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function load() {
  if (!fs.existsSync(dbPath)) {
    return { guilds: {}, history: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  } catch {
    return { guilds: {}, history: [] };
  }
}

function save(data) {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function defaultGuild(guildId) {
  return {
    guild_id: guildId,
    dj_role_id: null,
    stay_247: 0,
    locked_channel_id: null,
    default_volume: 50,
    text_channel_id: null,
    voice_channel_id: null,
    updated_at: new Date().toISOString(),
  };
}

function ensureGuild(guildId) {
  const data = load();
  if (!data.guilds[guildId]) {
    data.guilds[guildId] = defaultGuild(guildId);
    save(data);
  }
  return data.guilds[guildId];
}

function getGuildSettings(guildId) {
  return ensureGuild(guildId);
}

function updateGuildSettings(guildId, updates) {
  const data = load();
  const current = data.guilds[guildId] || defaultGuild(guildId);

  data.guilds[guildId] = {
    ...current,
    dj_role_id: updates.dj_role_id !== undefined ? updates.dj_role_id : current.dj_role_id,
    stay_247: updates.stay_247 !== undefined ? (updates.stay_247 ? 1 : 0) : current.stay_247,
    locked_channel_id: updates.locked_channel_id !== undefined ? updates.locked_channel_id : current.locked_channel_id,
    default_volume: updates.default_volume !== undefined ? updates.default_volume : current.default_volume,
    text_channel_id: updates.text_channel_id !== undefined ? updates.text_channel_id : current.text_channel_id,
    voice_channel_id: updates.voice_channel_id !== undefined ? updates.voice_channel_id : current.voice_channel_id,
    updated_at: new Date().toISOString(),
  };

  save(data);
  return data.guilds[guildId];
}

function addToHistory(guildId, title, url, requestedBy) {
  const data = load();
  data.history = data.history || [];
  data.history.unshift({
    guild_id: guildId,
    title,
    url,
    requested_by: requestedBy,
    played_at: new Date().toISOString(),
  });
  if (data.history.length > 500) data.history.length = 500;
  save(data);
}

function getHistory(guildId, limit = 20) {
  const data = load();
  return (data.history || []).filter((h) => h.guild_id === guildId).slice(0, limit);
}

module.exports = {
  getGuildSettings,
  updateGuildSettings,
  addToHistory,
  getHistory,
};
