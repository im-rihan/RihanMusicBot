const { PermissionFlagsBits } = require('discord.js');
const { getGuildSettings } = require('../database');
const config = require('../config');

function isOwner(userId) {
  return config.ownerId && userId === config.ownerId;
}

function isAdmin(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator) || isOwner(member.id);
}

function hasDjRole(member) {
  const settings = getGuildSettings(member.guild.id);
  if (!settings.dj_role_id) return true;
  if (isAdmin(member)) return true;
  return member.roles.cache.has(settings.dj_role_id);
}

function canControlPlayer(member) {
  return hasDjRole(member) || isAdmin(member);
}

function getVoiceChannel(member) {
  return member.voice?.channel || null;
}

function sameVoiceChannel(member, botChannelId) {
  const channel = getVoiceChannel(member);
  return channel && channel.id === botChannelId;
}

function checkVoiceRequirements(interaction, { needSameChannel = true, needDj = false } = {}) {
  const member = interaction.member;
  const voice = getVoiceChannel(member);

  if (!voice) {
    return { ok: false, message: 'You need to be in a voice channel.' };
  }

  if (!voice.joinable || !voice.speakable) {
    return { ok: false, message: 'I cannot join or speak in that voice channel.' };
  }

  const settings = getGuildSettings(interaction.guildId);
  if (settings.locked_channel_id && settings.locked_channel_id !== voice.id && !isAdmin(member)) {
    return { ok: false, message: `Music is locked to <#${settings.locked_channel_id}>.` };
  }

  const queue = interaction.client.music.get(interaction.guildId);
  if (needSameChannel && queue?.voiceChannelId && !sameVoiceChannel(member, queue.voiceChannelId) && !isAdmin(member)) {
    return { ok: false, message: 'You must be in the same voice channel as the bot.' };
  }

  if (needDj && !canControlPlayer(member)) {
    return { ok: false, message: 'Only DJs or admins can use this command.' };
  }

  return { ok: true, voice };
}

module.exports = {
  isOwner,
  isAdmin,
  hasDjRole,
  canControlPlayer,
  getVoiceChannel,
  sameVoiceChannel,
  checkVoiceRequirements,
};
