const {
  Client,
  GatewayIntentBits,
  Collection,
  Partials,
} = require('discord.js');
const config = require('./config');
const { loadCommands, loadEvents } = require('./utils/loader');
const { MusicPlayer } = require('./player/musicPlayer');
const { createLogger } = require('./utils/logger');

const logger = createLogger('main');

if (!config.token || !config.clientId) {
  logger.error('Missing DISCORD_TOKEN or CLIENT_ID in .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();
client.music = new MusicPlayer(client);

async function bootstrap() {
  await loadCommands(client);
  await loadEvents(client);
  await client.login(config.token);
}

bootstrap().catch((err) => {
  logger.error('Failed to start bot:', err);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception:', err);
});
