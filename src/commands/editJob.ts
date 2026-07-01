import { ChannelType, ChatInputCommandInteraction, MessageFlagsBitField, SlashCommandBuilder } from "discord.js";
import { ADMIN_PERMISSION_BIT, MILISECONDS_PER_SECOND } from "../lib/consts";
import { findJobById } from "../lib/dbScripts";
import { db } from "../lib/env";
import { jobTable } from "../lib/schema";
import { eq } from "drizzle-orm";
import { clearJobTask, createJobTaskIfNotPaused, jobToString } from "../lib/jobStore";
import { logger } from "../lib/logger";

const data = new SlashCommandBuilder()
    .setName('editjob')
    .setDescription('Edit an existing job. Preserves sent posts.')
    .setDefaultMemberPermissions(1 << ADMIN_PERMISSION_BIT)
    .addIntegerOption(option => 
        option.setName('id')
            .setDescription('ID of the job you want to edit')
            .setRequired(true)
    )
    .addStringOption(option => 
        option.setName('taglist')
            .setDescription('Safebooru tags to search by')
    )
    .addStringOption(option => 
        option.setName('message')
            .setDescription('Custom message to be sent with each post')
            .setMinLength(0)
            .addChoices()
    )
    .addChannelOption(option =>
        option.setName('channel')
            .setDescription('Channel to send posts to')
            .addChannelTypes(ChannelType.GuildText)
    )
    .addIntegerOption(option =>
        option.setName('intervalseconds')
            .setDescription('Number of seconds between posts')
    )
    .addIntegerOption(option =>
        option.setName('shifttimestamp')
            .setDescription('Moves the time the posts are sent at by a number of seconds.')
    )
    .addStringOption(option =>
        option.setName('cron')
            .setDescription('Alternative interval specifier using cron syntax')
    )
    .addIntegerOption(option => 
        option.setName('catchup')
            .setDescription('How many missed posts to catch up on, should the bot miss any. Does not work for cron. Default: 1')
    );

export default {
    data,
    async execute(interaction: ChatInputCommandInteraction) {
        const id = interaction.options.getInteger('id')!;        
        const job = await findJobById(id);

        if (job?.guildId !== interaction.guildId) {
            return interaction.reply({
                content: `Couldn't find a post with ID ${id}.`,
                flags: MessageFlagsBitField.Flags.Ephemeral
            });
        }

        const tagList = interaction.options.getString('taglist');
        const message = interaction.options.getString('message');
        const intervalSeconds = interaction.options.getInteger('intervalseconds');
        const shiftTimestamp = interaction.options.getInteger('shifttimestamp');
        const cron = interaction.options.getString('cron');
        const catchup = interaction.options.getInteger('catchup');
        const channel = interaction.options.getChannel('channel');

        if (intervalSeconds && cron) {
            return interaction.reply({
                content: `You can't mix seconds and cron.`,
                flags: MessageFlagsBitField.Flags.Ephemeral
            });
        }

        let notes = "";
        if (shiftTimestamp && cron) {
            notes += "Shifting the timestamp doesn't do anything for cron jobs.";
        }
        if (catchup && catchup > 0 && cron) {
            notes += "Catchup doesn't do anything for cron jobs.";
        }
        if (notes.length > 0) {
            notes = "\nNOTES: " + notes;
        }

        const updateObject: {
            tagList?: string,
            message?: string,
            intervalSeconds?: number,
            timestamp?: number,
            cron?: string,
            catchupLimit?: number,
            channelId?: string
        } = {};
        if (tagList) updateObject.tagList = tagList;
        if (message) updateObject.message = message;
        if (intervalSeconds) updateObject.intervalSeconds = intervalSeconds;
        if (shiftTimestamp) updateObject.timestamp = job.timestamp + shiftTimestamp * MILISECONDS_PER_SECOND;
        if (cron) updateObject.cron = cron;
        if (catchup) updateObject.catchupLimit = catchup;
        if (channel) updateObject.channelId = channel.id;

        try {
            const updatedJob = (await db.update(jobTable).set(updateObject).where(eq(jobTable.id, id)).returning()).at(0)!;
            clearJobTask(id);
            createJobTaskIfNotPaused(interaction.client, updatedJob);
            await interaction.reply({
                content: `Job edited successfully! New values: ${jobToString(updatedJob, true)}${notes}`,
                flags: MessageFlagsBitField.Flags.Ephemeral
            });
        } catch (error) {
            logger.error(error);
            if (error instanceof Error) {
                await interaction.reply({
                    content: `Error: ${error.message}`,
                    flags: MessageFlagsBitField.Flags.Ephemeral
                });
            }
        }
    }
};
