const { SlashCommandBuilder, ActivityType } = require('discord.js');
const config = require('../config/config.json');
const fs = require('node:fs'); // <--- ADD THIS IMPORT
const path = require('node:path'); // <--- ADD THIS IMPORT

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setactivity')
        .setDescription('Sets the bot\'s custom activity (Rich Presence).')
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of activity (e.g., Playing, Watching, Listening, Competing)')
                .setRequired(true)
                .addChoices(
                    { name: 'Playing', value: ActivityType.Playing.toString() },
                    { name: 'Watching', value: ActivityType.Watching.toString() },
                    { name: 'Listening to', value: ActivityType.Listening.toString() },
                    { name: 'Competing in', value: ActivityType.Competing.toString() },
                    { name: 'Streaming (Requires URL)', value: ActivityType.Streaming.toString() }
                ))
        .addStringOption(option =>
            option.setName('name')
                .setDescription('The name of the activity (e.g., "Valorant", "Music", "Netflix")')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('url')
                .setDescription('Streaming URL (only for Streaming type, e.g., Twitch URL)')
                .setRequired(false)),

    async execute(interaction) {
        const allowedRoleIds = config.permissions.allowed_role_ids;
        const memberRoles = interaction.member.roles.cache;
        const hasPermission = allowedRoleIds.some(roleId => memberRoles.has(roleId));

        if (!hasPermission) {
            return interaction.reply({
                content: 'You do not have permission to use this command.',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const type = parseInt(interaction.options.getString('type'));
        const name = interaction.options.getString('name');
        const url = interaction.options.getString('url');

        if (type === ActivityType.Streaming && (!url || !url.startsWith('https://www.twitch.tv/'))) {
            return interaction.editReply('For "Streaming" activity, you must provide a valid Twitch URL.');
        }

        try {
            const activityOptions = { type: type };
            if (type === ActivityType.Streaming && url) {
                activityOptions.url = url;
            }

            await interaction.client.user.setActivity(name, activityOptions);

            // --- SAVE TO CONFIG.JSON ---
            config.bot_presence.activity = { // Update in memory config
                type: ActivityType[type], // Convert enum back to string for saving
                name: name,
                url: url || null // Save null if no URL
            };
            const configPath = path.resolve(__dirname, '../config/config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2)); // Write to file
            // --- END SAVE ---

            let replyMessage = `Bot activity set to: **${ActivityType[type]} ${name}** (Saved for restarts)`;
            if (url) {
                replyMessage += ` (URL: ${url})`;
            }
            await interaction.editReply(replyMessage);
            console.log(`Bot activity changed to ${ActivityType[type]} ${name} by ${interaction.user.tag}`);

        } catch (error) {
            console.error(`Error setting bot activity to ${ActivityType[type]} ${name}:`, error);
            await interaction.editReply('Failed to set bot activity. Check console for errors.');
        }
    },
};