const fs = require('node:fs'); // <--- ADD THIS IMPORT
const path = require('node:path');
const { Client, GatewayIntentBits, Collection, Events, REST, Routes, ActivityType } = require('discord.js');
const config = require('./config/config.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
    ],
});

client.commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        console.log(`Loaded command: ${command.data.name}`);
    } else {
        console.warn(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.events = new Collection();
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if ('name' in event && 'execute' in event) {
        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }
        client.events.set(event.name, event);
        console.log(`Loaded event: ${event.name}`);
    } else {
        console.warn(`[WARNING] The event at ${filePath} is missing a required "name" or "execute" property.`);
    }
}


client.once(Events.ClientReady, async c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    console.log(`Bot ID: ${c.user.id}`);
    console.log(`Currently in ${client.guilds.cache.size} guilds.`);

    // --- APPLY SAVED BOT PRESENCE ON STARTUP ---
    const { status, activity } = config.bot_presence;

    if (activity && activity.name && activity.type) {
        // Map string activity type to Discord.js ActivityType enum
        const activityTypeEnum = ActivityType[activity.type];
        if (activityTypeEnum !== undefined) {
            const activityOptions = { type: activityTypeEnum };
            if (activity.url) {
                activityOptions.url = activity.url;
            }
            await c.user.setActivity(activity.name, activityOptions);
        } else {
            console.warn(`[PRESENCE] Unknown ActivityType '${activity.type}' in config.json. Defaulting to no activity.`);
        }
    } else {
        // Clear activity if not defined in config
        c.user.setActivity(null);
    }

    if (status) {
        await c.user.setStatus(status);
    } else {
        // Default to online if status not defined
        c.user.setStatus('online');
    }
    console.log(`Bot presence loaded from config: Status - ${status || 'online'}, Activity - ${activity ? `${activity.type} ${activity.name}` : 'None'}.`);
    // --- END APPLY SAVED BOT PRESENCE ---

    // Deploy slash commands
    const commandsToDeploy = [];
    for (const command of client.commands.values()) {
        commandsToDeploy.push(command.data.toJSON());
    }

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);;

    try {
        console.log(`Started refreshing ${commandsToDeploy.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationGuildCommands(c.user.id, config.guild_id),
            { body: commandsToDeploy },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands in guild ${config.guild_id}.`);
    } catch (error) {
        console.error(error);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});


client.login(process.env.DISCORD_TOKEN);

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});