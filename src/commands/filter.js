const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { listFilters } = require('../player/filters');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('filter')
    .setDescription('Toggle bass boost or set an equalizer preset')
    .addStringOption((opt) =>
      opt
        .setName('preset')
        .setDescription('Filter preset')
        .setRequired(true)
        .addChoices(
          { name: 'Flat (off)', value: 'flat' },
          { name: 'Bass Boost', value: 'bassboost' },
          { name: 'Soft Bass', value: 'softbass' },
          { name: 'Treble', value: 'treble' },
          { name: 'Nightcore', value: 'nightcore' },
          { name: 'Vaporwave', value: 'vaporwave' },
          { name: 'Karaoke', value: 'karaoke' }
        )
    ),
  async execute(interaction) {
    const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
    if (!check.ok) return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });

    const preset = interaction.options.getString('preset', true);
    const queue = interaction.client.music.get(interaction.guildId);
    if (!queue) {
      return interaction.reply({ embeds: [errorEmbed('No active player. Filters apply to the next track.')], ephemeral: true });
    }

    if (preset === 'bassboost') {
      interaction.client.music.setBassBoost(interaction.guildId, true);
    } else {
      interaction.client.music.setEq(interaction.guildId, preset);
    }

    return interaction.reply({
      embeds: [
        successEmbed(
          `Filter set to **${preset}**. It applies when the next track starts.\nAvailable: ${listFilters().join(', ')}`
        ),
      ],
    });
  },
};
