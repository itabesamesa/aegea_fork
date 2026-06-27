import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, MessageFlagsBitField, SlashCommandBuilder } from "discord.js";
import { deleteJob, findJobById } from "../lib/dbScripts";
import { jobToString } from "../lib/jobStore";
import { ADMIN_PERMISSION_BIT } from "../lib/consts";

const data = new SlashCommandBuilder()
    .setName('deletejob')
    .setDescription('Delete a job.')
    .setDefaultMemberPermissions(1 << ADMIN_PERMISSION_BIT)
    .addIntegerOption(option =>
        option.setName("id")
            .setDescription("The ID of the job you want to delete.")
            .setRequired(true)
    );

export default {
    data,
    async execute(interaction: ChatInputCommandInteraction) {
        const id = interaction.options.getInteger("id")!;
        const job = await findJobById(id);
        if (job.at(0)?.guildId !== interaction.guildId) {
            return interaction.reply({
                content: `Couldn't find a post with ID ${id}.`,
                flags: MessageFlagsBitField.Flags.Ephemeral
            });
        }
        const sameChannel = job[0].channelId === interaction.channelId;

        const confirm = new ButtonBuilder().setCustomId('confirm').setLabel('Confirm Delete').setStyle(ButtonStyle.Danger);
		const cancel = new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary);
		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(cancel, confirm);

        const response = await interaction.reply({
            content: `Are you sure you want to delete this job? [NO UNDO] ${jobToString(job[0], !sameChannel)}`,
            flags: MessageFlagsBitField.Flags.Ephemeral,
            components: [row],
            withResponse: true
        });

        try {
            const confirmation = (await response.resource?.message?.awaitMessageComponent({ time: 60_000 }))!;

            if (confirmation.customId === 'confirm') {
                const deletion = await deleteJob(id);
                if (deletion) {
                    return confirmation.update({ content: `Error: ${deletion.message}`, components: [] });
                } 
                await confirmation.update({ content: `Successfully deleted job: ${jobToString(job[0], !sameChannel)}`, components: [] });
            } else if (confirmation.customId === 'cancel') {
                await confirmation.update({ content: 'Deletion cancelled.', components: [] });
            }
        } catch {
            await interaction.editReply({ content: 'Confirmation not received within 1 minute, cancelling', components: [] });
        }
    }
};