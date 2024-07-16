const { Client, GatewayIntentBits, Partials } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const token = process.env.DISCORD_BOT_TOKEN;

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  const devRoleId = '1262534159855784007'; // Server dev role ID
  const commissionerRoleId = '1262533267232395324'; // Commissioner role ID
  const categoryID = '1262538583554920601'; // Your specified category ID

  // Check for the dev or commissioner role before executing commands
  const hasPermission = message.member.roles.cache.has(devRoleId) || message.member.roles.cache.has(commissionerRoleId);

  if (message.content.startsWith('!match') || message.content.startsWith('!close')) {
    if (!hasPermission) {
      message.reply('You do not have permission to use this command.');
      return;
    }
  }

  if (message.content.startsWith('!match')) {
    const guild = message.guild;

    if (!guild) return;

    const mentionedUsers = message.mentions.users;

    if (mentionedUsers.size < 2) {
      message.reply('Please mention two users for the match.');
      return;
    }

    const permissionOverwrites = [
      {
        id: guild.roles.everyone.id,
        deny: ['ViewChannel']
      },
      {
        id: message.author.id,
        allow: ['ViewChannel', 'SendMessages']
      },
      {
        id: devRoleId,
        allow: ['ViewChannel', 'SendMessages']
      },
      {
        id: commissionerRoleId,
        allow: ['ViewChannel', 'SendMessages']
      }
    ];

    mentionedUsers.forEach(user => {
      permissionOverwrites.push({
        id: user.id,
        allow: ['ViewChannel', 'SendMessages']
      });
    });

    // Create a private channel for the ticket under the specified category
    const ticketChannel = await guild.channels.create({
      name: `ticket-${message.author.username}`,
      type: 0, // GUILD_TEXT
      parent: categoryID,
      permissionOverwrites: permissionOverwrites
    });

    ticketChannel.send(`Hello ${message.author}, your ticket has been created for the match between ${mentionedUsers.map(user => user.tag).join(' and ')}.`);
  }

  if (message.content.startsWith('!close')) {
    if (message.channel.name.startsWith('ticket-')) {
      message.channel.send('This ticket will be closed.').then(() => {
        setTimeout(() => {
          message.channel.delete().catch(console.error);
        }, 5000); // Delay to allow the message to be read before deletion
      });
    } else {
      message.reply('This command can only be used in ticket channels.');
    }
  }
});

client.login(token);
