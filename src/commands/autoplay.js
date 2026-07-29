const { SlashCommandBuilder } = require('discord.js');
const { checkVoiceRequirements } = require('../utils/permissions');
const { errorEmbed, successEmbed } = require('../utils/embeds');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('autoplay')
    .setDescription('Toggle autoplay of related songs when the queue ends')
    .addBooleanOption((opt) =>
      opt.setName('enabled').setDescription('Enable or disable autoplay').setRequired(true)
    ),
  async execute(interaction) {
    const check = checkVoiceRequirements(interaction, { needSameChannel: true, needDj: true });
    if (!check.ok) return interaction.reply({ embeds: [errorEmbed(check.message)], ephemeral: true });

    const queue = interaction.client.music.ensure(interaction.guildId);
    queue.autoplay = interaction.options.getBoolean('enabled', true);

    return interaction.reply({
      embeds: [successEmbed(`Autoplay is now **${queue.autoplay ? 'enabled' : 'disabled'}**.`)],
    });
  },
};
