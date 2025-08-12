const fs = require('node:fs');
const path = require('node:path');
const { Client, GatewayIntentBits, Collection, Events, REST, Routes, ActivityType } = require('discord.js');

// Load config.json defaults
const config = require('./config/config.json');

// Helper: get env var or fallback to config value
const getConfigValue = (envName, configValue) => process.env[envName] || configValue;

// Resolve all variables from ENV or config.json
const resolvedConfig = {
    bot: {
        token: getConfigValue('DISCORD_TOKEN', config.bot.token)
    },
    channels: {
        join_log: getConfigValue('JOIN_LOG_CHANNEL_ID', config.channels.join_log),
        leave_log: getConfigValue('LEAVE_LOG_CHANNEL_ID', config.channels.leave_log)
    },
    fallback_messages: config.fallback_messages,
    events: config.events,
    guild_id: getConfigValue('GUILD_ID', config.guild_id),
    permissions: {
        allowed_role_ids: [
            getConfigValue('ALLOWED_ROLE_ID', config.permissions.allowed_role_ids[0])
        ]
    },
    bot_presence: {
        status: getConfigValue('BOT_STATUS', config.bot_presence.status),
        activity: {
            type: getConfigValue('BOT_ACTIVITY_TYPE', config.bot_presence.activity.type),
            name: getConfigValue('BOT_ACTIVITY_NAME', config.bot_presence.activity.name),
            url: getConfigValue('BOT_ACTIVITY_URL', config.bot_presence.activity.url)
        }
    }
};

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
if (fs.existsSync(commandsPath)) {
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
}

// Load events
client.events = new Collection();
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
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
}

client.once(Events.ClientReady, async c => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
    console.log(`Bot ID: ${c.user.id}`);
    console.log(`Currently in ${client.guilds.cache.size} guilds.`);

    // Bot presence
    const { status, activity } = resolvedConfig.bot_presence;
    if (activity && activity.name && activity.type) {
        const activityTypeEnum = ActivityType[activity.type];
        if (activityTypeEnum !== undefined) {
            const activityOptions = { type: activityTypeEnum };
            if (activity.url) activityOptions.url = activity.url;
            await c.user.setActivity(activity.name, activityOptions);
        } else {
            console.warn(`[PRESENCE] Unknown ActivityType '${activity.type}'.`);
        }
    } else {
        c.user.setActivity(null);
    }

    if (status) {
        await c.user.setStatus(status);
    } else {
        c.user.setStatus('online');
    }

    // Deploy slash commands
    const commandsToDeploy = [...client.commands.values()].map(cmd => cmd.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(resolvedConfig.bot.token);

    try {
        console.log(`Refreshing ${commandsToDeploy.length} application (/) commands.`);
        const data = await rest.put(
            Routes.applicationGuildCommands(c.user.id, resolvedConfig.guild_id),
            { body: commandsToDeploy }
        );
        console.log(`Reloaded ${data.length} application (/) commands in guild ${resolvedConfig.guild_id}.`);
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
        const replyContent = { content: 'There was an error while executing this command!', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(replyContent);
        } else {
            await interaction.reply(replyContent);
        }
    }
});

client.login(resolvedConfig.bot.token);

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});
