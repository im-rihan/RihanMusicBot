const { canControlPlayer, checkVoiceRequirements } = require('../utils/permissions');
const { successEmbed, errorEmbed } = require('../utils/embeds');

async function handleButton(interaction, client) {
  const id = interaction.customId;
  if (!id.startsWith('music_')) return;

  const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
  if (!check.ok) {
    return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });
  }

  const queue = client.music.get(interaction.guildId);
  if (!queue?.current && id !== 'music_stop') {
    return interaction.reply({ embeds: [errorEmbed('Nothing is playing right now.')], ephemeral: true });
  }

  switch (id) {
    case 'music_pause': {
      const ok = client.music.pause(interaction.guildId);
      return interaction.reply({ embeds: [ok ? successEmbed('Paused.') : errorEmbed('Could not pause.')], ephemeral: true });
    }
    case 'music_resume': {
      const ok = client.music.resume(interaction.guildId);
      return interaction.reply({ embeds: [ok ? successEmbed('Resumed.') : errorEmbed('Could not resume.')], ephemeral: true });
    }
    case 'music_skip': {
      const skipped = await client.music.skip(interaction.guildId);
      return interaction.reply({
        embeds: [skipped ? successEmbed(`Skipped **${skipped.title}**.`) : errorEmbed('Nothing to skip.')],
        ephemeral: true,
      });
    }
    case 'music_loop': {
      const mode = client.music.cycleLoop(interaction.guildId);
      return interaction.reply({ embeds: [successEmbed(`Loop mode set to **${mode}**.`)], ephemeral: true });
    }
    case 'music_stop': {
      if (!canControlPlayer(interaction.member)) {
        return interaction.reply({ embeds: [errorEmbed('Only DJs or admins can stop playback.')], ephemeral: true });
      }
      client.music.stop(interaction.guildId);
      return interaction.reply({ embeds: [successEmbed('Stopped playback and cleared the queue.')], ephemeral: true });
    }
    default:
      return interaction.reply({ embeds: [errorEmbed('Unknown button.')], ephemeral: true });
  }
}

module.exports = { handleButton };
