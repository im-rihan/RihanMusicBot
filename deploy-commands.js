require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./src/config');
const { createLogger } = require('./src/utils/logger');

const logger = createLogger('deploy');

async function deploy() {
  if (!config.token || !config.clientId) {
    throw new Error('DISCORD_TOKEN and CLIENT_ID are required in .env');
  }

  const commands = [];
  const commandsPath = path.join(__dirname, 'src', 'commands');
  const files = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

  for (const file of files) {
    const command = require(path.join(commandsPath, file));
    if (command?.data?.toJSON) {
      commands.push(command.data.toJSON());
      logger.info(`Prepared /${command.data.name}`);
    }
  }

  const rest = new REST({ version: '10' }).setToken(config.token);

  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), {
      body: commands,
    });
    logger.info(`Deployed ${commands.length} guild commands to ${config.guildId}`);
  } else {
    await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
    logger.info(`Deployed ${commands.length} global commands`);
  }
}

deploy().catch((err) => {
  logger.error(err);
  process.exit(1);
});
