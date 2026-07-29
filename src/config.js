require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  ownerId: process.env.OWNER_ID || null,
  embedColor: parseInt(process.env.EMBED_COLOR || '5865F2', 16),
  defaultVolume: Math.min(100, Math.max(0, Number(process.env.DEFAULT_VOLUME) || 50)),
  maxQueueSize: 200,
  leaveOnEmpty: true,
  leaveOnEmptyCooldown: 60_000,
  leaveOnEnd: true,
  leaveOnEndCooldown: 60_000,
  progressBarLength: 15,
  branding: require('./branding'),
};
