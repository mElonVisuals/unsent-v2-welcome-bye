const { Events, EmbedBuilder } = require('discord.js');
const config = require('../config/config.json');

module.exports = {
    name: Events.GuildMemberAdd,
    once: false,
    async execute(member, client) { // 'client' is correctly passed here
        console.log(`Member Joined: ${member.user.tag} (${member.id}) to ${member.guild.name}`);

        const joinChannelId = config.channels.join_log;

        const embedConfig = config.events.guildMemberAdd.embed;
        const embedTitleTemplate = embedConfig.title;
        const embedDescriptionTemplate = embedConfig.description;
        const eyeEmojiId = embedConfig.eye_emoji_id;
        const authorIconUrl = embedConfig.author_icon_url;

        const joinMessageTemplate = config.fallback_messages.join;


        if (!joinChannelId) {
            console.warn('Join channel ID not set in config.json. Skipping join embed.');
            return;
        }

        try {
            const channel = await member.guild.channels.fetch(joinChannelId);

            if (channel && channel.isTextBased()) {
                const customEyeEmoji = `<:custom_eye:${eyeEmojiId}>`;
                const botUsername = client.user.username;

                // Replace both {eye_emoji} AND {bot_name} placeholders
                const title = embedTitleTemplate
                    .replace('{eye_emoji}', customEyeEmoji)
                    .replace('{bot_name}', botUsername); // <--- MODIFIED HERE

                const description = embedDescriptionTemplate.replace('{username}', member.user.username);

                const welcomeEmbed = new EmbedBuilder()
                    .setTitle(title)
                    .setDescription(description)
                    .setColor(0x7823eb);

                if (authorIconUrl) {
                    welcomeEmbed.setAuthor({
                        name: botUsername,
                        iconURL: authorIconUrl
                    });
                }


                await channel.send({ embeds: [welcomeEmbed] });

            } else {
                console.error(`Could not find or send to join channel with ID: ${joinChannelId}. Is it a text channel?`);
            }
        } catch (error) {
            console.error(`Error sending join embed for ${member.user.tag}:`, error);
            if (error.code === 50001) {
                console.error('Bot might be missing permissions to view/send messages in the join channel.');
            } else if (error.code === 10003) {
                console.error('The provided join_channel_id is invalid or the bot cannot see it.');
            }
            try {
                const channel = await member.guild.channels.fetch(joinChannelId);
                if (channel && channel.isTextBased()) {
                    let messageToSend = joinMessageTemplate
                        .replace('{user}', member.user.toString())
                        .replace('{server.name}', member.guild.name);
                    await channel.send(`[Fallback] ${messageToSend}`);
                }
            } catch (fallbackError) {
                console.error('Failed to send fallback join message:', fallbackError);
            }
        }
    },
};