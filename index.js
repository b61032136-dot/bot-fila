const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// Load handlers
require('./handlers/messageHandler')(client);
require('./handlers/interactionHandler')(client);

client.once('ready', () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

client.login(process.env.TOKEN);
