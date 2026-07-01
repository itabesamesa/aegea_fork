import { ChatInputCommandInteraction, MessageFlagsBitField, SlashCommandBuilder } from "discord.js";
import { ADMIN_PERMISSION_BIT } from "../lib/consts";
import { findJobById } from "../lib/dbScripts";
import { sendPost } from "../lib/post";
import { logger } from "../lib/logger";

const data = new SlashCommandBuilder()
    .setName('sendonepost')
    .setDescription('Send one post from a job\'s pool.')
    .setDefaultMemberPermissions(1 << ADMIN_PERMISSION_BIT)
    .addIntegerOption(option =>
        option.setName("id")
            .setDescription("ID of the job.")
            .setRequired(true)
    );

export default {
    data,
    async execute(interaction: ChatInputCommandInteraction) {
        const id = interaction.options.getInteger('id')!;
        const job = await findJobById(id);

        if (job?.guildId !== interaction.guildId) {
            return interaction.reply({
                content: `Could not find job with id: ${id}`,
                flags: MessageFlagsBitField.Flags.Ephemeral
            });
        }

        try {
            const message = await sendPost(interaction.client, job);

            if (message?.url) {
                await interaction.reply({
                    content: `Sent: ${message.url}`,
                    flags: MessageFlagsBitField.Flags.Ephemeral
                });
            } else {
                await interaction.reply({
                    content: `Something went wrong.`,
                    flags: MessageFlagsBitField.Flags.Ephemeral
                });
            }
        } catch (error) {
            logger.error(error);
        }
    }
};
