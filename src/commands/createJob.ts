import { ChatInputCommandInteraction, MessageFlagsBitField, SlashCommandBuilder } from "discord.js";
import { jobTable } from "../lib/schema";
import { db } from "../lib/env";
import { IntervalTypes } from "../lib/intervals";
import { createJobTaskIfNotPaused } from "../lib/jobStore";
import { ADMIN_PERMISSION_BIT, MILISECONDS_PER_SECOND, SECONDS_PER_DAY, SECONDS_PER_HOUR, SECONDS_PER_MINUTE } from "../lib/consts";
import { logger } from "../lib/logger";
import { CronValidationResult, validateCron } from "../lib/cron";



const data = new SlashCommandBuilder()
    .setName('createjob')
    .setDescription('Create a job to periodically post images in THIS channel.')
    .setDefaultMemberPermissions(1 << ADMIN_PERMISSION_BIT)
    .addStringOption(option => 
        option.setName('taglist')
            .setDescription('Safebooru tags to search by')
            .setRequired(true)
    )
    .addStringOption(option => 
        option.setName('message')
            .setDescription('Custom message to be sent with each post')
    )
    .addIntegerOption(option =>
        option.setName('intervalseconds')
            .setDescription('Number of seconds between posts')
    )
    .addIntegerOption(option =>
        option.setName('intervalminutes')
            .setDescription('Number of minutes between posts')
    )
    .addIntegerOption(option =>
        option.setName('intervalhours')
            .setDescription('Number of hours between posts')
    )
    .addIntegerOption(option =>
        option.setName('intervaldays')
            .setDescription('Number of days between posts')
    )
    .addIntegerOption(option =>
        option.setName('initialdelay')
            .setDescription('Number of seconds to wait before the first post should be sent')
    )
    .addStringOption(option =>
        option.setName('cron')
            .setDescription('Alternative interval specifier using cron syntax')
    )
    .addIntegerOption(option => 
        option.setName('catchup')
            .setDescription('How many missed posts to catch up on, should the bot miss any. Does not work for cron. Default: 1')
    )
    .addStringOption(option => 
        option.setName('timezone')
            .setDescription("Timezone to use for cron jobs. Defaults to the server's timezone.")
    );

export default {
    data,
    async execute(interaction: ChatInputCommandInteraction) {
        const intervalSeconds = interaction.options.getInteger('intervalseconds') ?? 0;
        const intervalMinutes = interaction.options.getInteger('intervalminutes') ?? 0;
        const intervalHours = interaction.options.getInteger('intervalhours') ?? 0;
        const intervalDays = interaction.options.getInteger('intervaldays') ?? 0;
        const cron = interaction.options.getString('cron');

        const secondsDelay = intervalSeconds +
        intervalMinutes * SECONDS_PER_MINUTE +
        intervalHours * SECONDS_PER_HOUR +
        intervalDays * SECONDS_PER_DAY;

        if (cron && secondsDelay) {
            return interaction.reply({
                content: "Error: You can't supply both a cron interval and a unit interval.",
                flags: MessageFlagsBitField.Flags.Ephemeral
            });
        }
        if (!cron && !secondsDelay) {
            return interaction.reply({
                content: "Error: You must supply either a cron interval or a unit interval.",
                flags: MessageFlagsBitField.Flags.Ephemeral
            });
        }

        const tagList = interaction.options.getString('taglist');
        const message = interaction.options.getString('message') ?? "";
        const initialDelay = interaction.options.getInteger('initialdelay') ?? 0;
        const catchupLimit = interaction.options.getInteger('catchup') ?? 1;
        const timezone = interaction.options.getString('timezone');

        try {
            const intervalType = secondsDelay ? IntervalTypes.seconds : IntervalTypes.cron;

            if (intervalType === IntervalTypes.cron) {
                const result = validateCron(cron!, timezone);
                if (result === CronValidationResult.invalidCron) {
                    return interaction.reply({
                        content: "Error: The provided cron can't be parsed.",
                        flags: MessageFlagsBitField.Flags.Ephemeral
                    });
                } else if (result === CronValidationResult.invalidTimezone) {
                    return interaction.reply({
                        content: "Error: The provided time zone can't be parsed.",
                        flags: MessageFlagsBitField.Flags.Ephemeral
                    });
                }
            }

            const dbEntry: typeof jobTable.$inferInsert = {
                guildId: interaction.guildId!,
                channelId: interaction.channelId,
                userId: interaction.user.id,
                tagList: tagList!,
                intervalType: intervalType,
                timestamp: Date.now() + initialDelay * MILISECONDS_PER_SECOND,
                message,
                intervalSeconds: secondsDelay,
                intervalCron: cron,
                catchupLimit,
                cronTimeZone: timezone
            };

            const job = await db.insert(jobTable).values(dbEntry).returning();
            createJobTaskIfNotPaused(interaction.client, job[0], { initialDelay, checkCatchUp: false });

            await interaction.reply({
                content: `Successfully created job! Will send random \`${tagList}\` post every ${secondsDelay} seconds`,
                flags: MessageFlagsBitField.Flags.Ephemeral
            });
        } catch(e: unknown) {
            if (e instanceof Error) {
                logger.error(e);
                interaction.reply({
                    content: `Error: ${e.message}`,
                    flags: MessageFlagsBitField.Flags.Ephemeral
                }).catch(e => {
                    logger.error(e);
                });
            }
        }
    }
};
