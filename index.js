const { Client, GatewayIntentBits, Partials, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  const devRoleId = '1262534159855784007'; // Server dev role ID
  const commissionerRoleId = '1262533267232395324'; // Commissioner role ID
  const categoryID = '1262538583554920601'; // Your specified category ID

  // Check for the dev or commissioner role before executing commands
  const hasPermission = message.member.roles.cache.has(devRoleId) || message.member.roles.cache.has(commissionerRoleId);

  if (message.content.startsWith('!match') || message.content.startsWith('!close') || message.content.startsWith('!winner') || message.content.startsWith('!purge') || message.content.startsWith('!wins')) {
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

    const mentions = mentionedUsers.map(user => `<@${user.id}>`).join(', ');
    ticketChannel.send(`Hello ${message.author}, your ticket has been created for the match between ${mentions}.`);
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

  if (message.content.startsWith('!winner')) {
    if (message.channel.name.startsWith('ticket-')) {
      const mentionedUsers = message.mentions.users;

      if (mentionedUsers.size < 1) {
        message.reply('Please mention the user who won the match.');
        return;
      }

      const winner = mentionedUsers.first();
      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('Close Ticket')
            .setStyle(ButtonStyle.Danger)
        );

      // Update wins in the JSON file
      let winsData = {};
      if (fs.existsSync(winsFilePath)) {
        winsData = JSON.parse(fs.readFileSync(winsFilePath));
      }
      if (!winsData[winner.id]) {
        winsData[winner.id] = { wins: 0 };
      }
      winsData[winner.id].wins += 1;
      fs.writeFileSync(winsFilePath, JSON.stringify(winsData, null, 2));

      message.channel.send({
        content: `Congratulations ${winner}, you have won the match! <@&${commissionerRoleId}>, ${winner.tag} has won their match. The ticket can now be closed.`,
        components: [row]
      });
    } else {
      message.reply('This command can only be used in ticket channels.');
    }
  }

  if (message.content.startsWith('!purge')) {
    const args = message.content.split(' ');

    if (args.length !== 2) {
      message.reply('Please specify the number of messages to delete. Usage: `!purge <number>`');
      return;
    }

    const deleteCount = parseInt(args[1], 10);

    if (isNaN(deleteCount) || deleteCount < 1 || deleteCount > 100) {
      message.reply('Please provide a number between 1 and 100 for the number of messages to delete.');
      return;
    }

    const fetched = await message.channel.messages.fetch({ limit: deleteCount });
    message.channel.bulkDelete(fetched)
      .catch(error => message.reply(`Couldn't delete messages because of: ${error}`));
  }

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
    message.reply(`${user.tag} has ${wins} wins.`);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  const devRoleId = '1262534159855784007'; // Server dev role ID
  const commissionerRoleId = '1262533267232395324'; // Commissioner role ID

  if (interaction.customId === 'close_ticket') {
    const hasPermission = interaction.member.roles.cache.has(devRoleId) || interaction.member.roles.cache.has(commissionerRoleId);

    if (!hasPermission) {
      await interaction.reply({ content: 'You do not have permission to use this button.', ephemeral: true });
      return;
    }

    await interaction.reply({ content: 'Closing the ticket...', ephemeral: true });
    setTimeout(() => {
      interaction.channel.delete().catch(console.error);
    }, 5000); // Delay to allow the message to be read before deletion
  }
});



if (message.content.startsWith('!help')){
  message.reply('Please Read this Document. https://docs.google.com/document/d/1uzsdKGoaz3ueeJ3CxjIhMdLqQ8-me5FCva0zuC4T5j4/edit?usp=sharing ')

}



client.login(token);
