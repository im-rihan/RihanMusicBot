const { MessageFlags } = require('discord.js');

async function safeDefer(interaction, options = {}) {
  if (interaction.deferred || interaction.replied) return false;
  try {
    await interaction.deferReply(options);
    return true;
  } catch (err) {
    // Another instance may have already acknowledged this interaction
    if (err.code === 40060 || err.code === 10062) return false;
    throw err;
  }
}

async function safeEditReply(interaction, payload) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply(payload);
  }
  return interaction.reply(payload);
}

async function safeErrorReply(interaction, embed) {
  const payload = { embeds: [embed], flags: MessageFlags.Ephemeral };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp(payload);
    } else {
      await interaction.reply(payload);
    }
  } catch {
    // ignore
  }
}

module.exports = { safeDefer, safeEditReply, safeErrorReply };
