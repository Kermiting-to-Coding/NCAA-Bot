const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
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
const winsFilePath = path.join(__dirname, 'wins.json');
const strikeRoleId = '1264770419420827758'; // Temp role ID

let winnerCommandCooldown = false;

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

// Interaction handler for button clicks
client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const { customId } = interaction;

  if (customId === 'close_ticket') {
    // Check if the current channel is a ticket channel
    if (interaction.channel.name.startsWith('ticket-')) {
      // Acknowledge the interaction and delete the channel
      await interaction.reply('Closing this ticket...');
      setTimeout(() => {
        interaction.channel.delete().catch(console.error);
      }, 5000); // 5-second delay before deletion
    } else {
      // If not a ticket channel, send a reply indicating the button can't be used here
      await interaction.reply({ content: 'This button can only be used in ticket channels.', ephemeral: true });
    }
  }
});

client.on('messageCreate', async (message) => {
  const devRoleId = '1262534159855784007'; // Server dev role ID
  const commissionerRoleId = '1262533267232395324'; // Commissioner role ID
  const categoryID = '1262538583554920601'; // Your specified category ID

  // Check for the dev or commissioner role before executing commands
  const hasPermission = message.member.roles.cache.has(devRoleId) || message.member.roles.cache.has(commissionerRoleId);

  // Wins Command to POST the Wins Data.
  if (message.content.startsWith('!wins')) {
    const mentionedUsers = message.mentions.users;

    if (mentionedUsers.size < 1) {
      message.reply('Please mention the user whose wins you want to check.');
      return;
    }

    const user = mentionedUsers.first();
    let winsData = {};
    if (fs.existsSync(winsFilePath)) {
      winsData = JSON.parse(fs.readFileSync(winsFilePath));
    }

    const wins = winsData[user.id] ? winsData[user.id].wins : 0;
    const losses = winsData[user.id] ? winsData[user.id].losses : 0;

    message.reply(`${user.tag} has ${wins} wins and ${losses} losses.`);
    return;
  }

  // Losses Command to POST the Losses Data.
  if (message.content.startsWith('!losses')) {
    const mentionedUsers = message.mentions.users;

    if (mentionedUsers.size < 1) {
      message.reply('Please mention the user whose losses you want to check.');
      return;
    }

    const user = mentionedUsers.first();
    let winsData = {};
    if (fs.existsSync(winsFilePath)) {
      winsData = JSON.parse(fs.readFileSync(winsFilePath));
    }

    const losses = winsData[user.id] ? winsData[user.id].losses : 0;
    message.reply(`${user.tag} has ${losses} losses.`);
    return;
  }

  // Request Commish to help them
  if (message.content.startsWith('!request')) {
    const messageAuthor = message.author.id;
    message.reply(`Hello <@&${commissionerRoleId}> <@${messageAuthor}> has requested your services please DM him.`);
    return;
  }

  // Command handler for various bot functions
  if (message.content.startsWith('!allwins')) {
    // Check if the wins file exists
    if (!fs.existsSync(winsFilePath)) {
      message.reply('No win records found.');
      return;
    }

    // Load the wins data from the file
    const winsData = JSON.parse(fs.readFileSync(winsFilePath));

    // If no users have been tracked yet, return a message
    if (Object.keys(winsData).length === 0) {
      message.reply('No win records available.');
      return;
    }

    // Create an array of users and sort by wins (in descending order)
    const sortedUsers = Object.keys(winsData).map(userId => {
      return { userId, wins: winsData[userId].wins || 0, losses: winsData[userId].losses || 0 };
    }).sort((a, b) => b.wins - a.wins);  // Sort by wins in descending order

    // Create a message to display all wins
    let allWinsMessage = '🏆 **League Win Records** 🏆\n\n';

    // Use for...of loop to handle async operations properly
    for (const [index, user] of sortedUsers.entries()) {
      const medal = index === 0 ? '🥇' : ''; // Add gold medal emoji for the top player
      const userTag = (await client.users.fetch(user.userId)).tag;  // Fetch the user's tag asynchronously
      allWinsMessage += `${medal} ${userTag}: ${user.wins} wins, ${user.losses} losses\n`;
    }

    message.channel.send(allWinsMessage);
  }

  // Commish and Server Dev Role allowed Commands
  if (message.content.startsWith('!match') || message.content.startsWith('!close') || message.content.startsWith('!winner') || message.content.startsWith('!purge') || message.content.startsWith('!delwin') || message.content.startsWith('!clearwins') || message.content.startsWith('!addloss') || message.content.startsWith('!delloss')) {
    if (!hasPermission) {
      message.reply('You do not have permission to use this command.');
      return; // Stop further execution if the user doesn't have permission
    }
  }

  // Strike Commands
  if (message.content.startsWith('!strike')) {
    if (!hasPermission) {
      message.reply('You do not have permission to use this command.');
      return;
    }

    const mentionedUsers = message.mentions.users;
    if (mentionedUsers.size < 1) {
      message.reply('Please mention the user to strike.');
      return;
    }

    const user = message.guild.members.cache.get(mentionedUsers.first().id);
    if (!user) {
      message.reply('User not found.');
      return;
    }

    // Check if the bot has permission to manage roles
    const botMember = message.guild.members.cache.get(client.user.id);
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      message.reply('I do not have permission to manage roles.');
      return;
    }

    // Add the strike role
    user.roles.add(strikeRoleId).then(() => {
      message.reply(`${user.user.tag} has been given the strike role.`);

      // Remove the role after 2 days
      setTimeout(() => {
        user.roles.remove(strikeRoleId).then(() => {
          message.channel.send(`${user.user.tag} has had the strike role removed.`);
        }).catch(error => {
          console.error(`Failed to remove strike role from ${user.user.tag}: ${error}`);
        });
      }, 2 * 24 * 60 * 60 * 1000); // 2 days in milliseconds
    }).catch(error => {
      console.error(`Failed to assign strike role to ${user.user.tag}: ${error}`);
      message.reply(`Failed to assign strike role: ${error.message}`);
    });
  }

  if (message.content.startsWith('!removestrike')) {
    if (!hasPermission) {
      message.reply('You do not have permission to use this command.');
      return;
    }

    const mentionedUsers = message.mentions.users;
    if (mentionedUsers.size < 1) {
      message.reply('Please mention the user to remove the strike from.');
      return;
    }

    const user = message.guild.members.cache.get(mentionedUsers.first().id);
    if (!user) {
      message.reply('User not found.');
      return;
    }

    // Check if the bot has permission to manage roles
    const botMember = message.guild.members.cache.get(client.user.id);
    if (!botMember.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      message.reply('I do not have permission to manage roles.');
      return;
    }

    // Remove the strike role
    user.roles.remove(strikeRoleId).then(() => {
      message.reply(`${user.user.tag} has had the strike role removed.`);
    }).catch(error => {
      console.error(`Failed to remove strike role from ${user.user.tag}: ${error}`);
      message.reply(`Failed to remove strike role: ${error.message}`);
    });
  }

  // Match Commands
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
      if (user.id !== message.author.id && user.id !== devRoleId && user.id !== commissionerRoleId) {
        permissionOverwrites.push({
          id: user.id,
          allow: ['ViewChannel', 'SendMessages']
        });
      }
    });

    // Create a private channel for the ticket under the specified category
    const ticketChannel = await guild.channels.create({
      name: `ticket-${message.author.username}`,
      type: 0, // GUILD_TEXT
      parent: categoryID,
      permissionOverwrites: permissionOverwrites
    });

    const mentions = mentionedUsers.map(user => `<@${user.id}>`).join(', ');
    ticketChannel.send(`Hello ${message.author}, your ticket has been created for the match between ${mentions}.`);
  }

  if (message.content.startsWith('!close')) {
    // Check if the current channel is a ticket channel
    if (message.channel.name.startsWith('ticket-')) {
      // Send a message indicating the ticket will be closed
      message.channel.send('This ticket will be closed.')
        .then(() => {
          // After a delay, delete the channel
          setTimeout(() => {
            message.channel.delete().catch(console.error);
          }, 5000); // 5-second delay before deletion
        })
        .catch(console.error); // Catch any errors in sending the message
    } else {
      // If not a ticket channel, send a reply indicating the command can't be used here
      message.reply('This command can only be used in ticket channels.');
    }
  }

  if (message.content.startsWith('!winner')) {
    if (winnerCommandCooldown) {
      message.reply('The winner command is currently on cooldown. Please wait a moment.');
      return;
    }
    winnerCommandCooldown = true;

    const args = message.mentions.users;
    if (args.size !== 2) {
      message.reply('Please mention exactly two users, the first being the winner and the second being the loser.');
      winnerCommandCooldown = false; // Reset cooldown if command fails
      return;
    }

    const winner = args.first();
    const loser = args.last();

    let winsData = {};
    if (fs.existsSync(winsFilePath)) {
      winsData = JSON.parse(fs.readFileSync(winsFilePath));
    }

    if (!winsData[winner.id]) {
      winsData[winner.id] = { wins: 0, losses: 0 };
    }
    winsData[winner.id].wins += 1;

    if (!winsData[loser.id]) {
      winsData[loser.id] = { wins: 0, losses: 0 };
    }
    winsData[loser.id].losses += 1;

    fs.writeFileSync(winsFilePath, JSON.stringify(winsData, null, 2));

    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId('close_ticket')
          .setLabel('Close Ticket')
          .setStyle(ButtonStyle.Danger)
      );

    await message.channel.send({
      content: `Congratulations ${winner}, you have won the match! ${loser}, better luck next time.\n<@&${commissionerRoleId}>, please close the ticket using the button below.`,
      components: [row]
    });

    // Reset cooldown after a short delay to prevent spamming
    setTimeout(() => {
      winnerCommandCooldown = false;
    }, 5000); // Adjust the delay as needed
  }

}); // Closing the client.on('messageCreate', async (message) => { event handler

client.login(token); // Log in the bot
