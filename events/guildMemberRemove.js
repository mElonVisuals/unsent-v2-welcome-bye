const { Events } = require('discord.js');
const config = require('../config/config.json');

module.exports = {
    name: Events.GuildMemberRemove,
    once: false,
    async execute(member) { // No 'client' needed here unless you plan to use bot data
        console.log(`Member Left: ${member.user.tag} (${member.id}) from ${member.guild.name}`);

        const leaveChannelId = config.channels.leave_log;
        const leaveMessageTemplate = config.fallback_messages.leave; // Gets the new bolded message

        if (!leaveChannelId) {
            console.warn('Leave channel ID not set in config.json. Skipping leave message.');
            return;
        }

        try {
            const channel = await member.guild.channels.fetch(leaveChannelId);
            if (channel && channel.isTextBased()) {
                let messageToSend = leaveMessageTemplate
                    .replace('{username}', member.user.username) // Use .username for plain text like in your example
                    .replace('{server.name}', member.guild.name); // Although not in your example, keep it for consistency if needed

                await channel.send(messageToSend);
            } else {
                console.error(`Could not find or send to leave channel with ID: ${leaveChannelId}. Is it a text channel?`);
            }
        } catch (error) {
            console.error(`Error sending leave message for ${member.user.tag}:`, error);
            if (error.code === 50001) {
                console.error('Bot might be missing permissions to view/send messages in the leave channel.');
            } else if (error.code === 10003) {
                console.error('The provided leave_channel_id is invalid or the bot cannot see it.');
            }
        }
    },
};