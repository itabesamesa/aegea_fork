import { CommandInteraction, MessageFlagsBitField, SlashCommandBuilder } from "discord.js";
import { jobTable } from "../lib/schema";
import { db } from "../lib/env";
import { IntervalTypes } from "../lib/intervals";
import { Job, jobs } from "../lib/jobStore";

const data = new SlashCommandBuilder()
    .setName('createjob')
    .setDescription('Create a job to periodically post images in THIS channel.')
    .setDefaultMemberPermissions(1 << 5)
    .addStringOption(option => 
        option.setName('taglist')
            .setDescription('Safebooru tags to search by')
            .setRequired(true)
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
    );

export default {
    data,
    async execute(interaction: CommandInteraction) {
        const optionsInteraction = interaction as any;
        const intervalSeconds = optionsInteraction.options.getInteger('intervalseconds') ?? 0;
        const intervalMinutes = optionsInteraction.options.getInteger('intervalminutes') ?? 0;
        const intervalHours = optionsInteraction.options.getInteger('intervalhours') ?? 0;
        const intervalDays = optionsInteraction.options.getInteger('intervaldays') ?? 0;
        const cron = optionsInteraction.options.getString('cron') ?? 0;

        if (cron && (intervalSeconds || intervalMinutes || intervalHours || intervalDays)) {
            interaction.reply({
                content: "Error: You can't supply both a cron interval and a unit intevral.",
                flags: MessageFlagsBitField.Flags.Ephemeral
            });
            return;
        }

        const secondsDelay = intervalSeconds +
            intervalMinutes * 60 +
            intervalHours * 60 * 60 +
            intervalDays * 60 * 60 * 24;

        const taglist = optionsInteraction.options.getString('taglist');

        try {
            const intervalType = secondsDelay ? IntervalTypes.seconds : IntervalTypes.cron;
            
            const dbEntry: typeof jobTable.$inferInsert = {
                guildId: interaction.guildId!,
                channelId: interaction.channelId,
                userId: interaction.user.id,
                tagList: taglist,
                intervalType: intervalType,
                timestamp: Date.now()
            };

            let job: Job | undefined;
            if (intervalType == IntervalTypes.seconds) {
                dbEntry.intervalSeconds = secondsDelay;
                job = {
                    type: "seconds",
                    secondsDelay,
                    start: dbEntry.timestamp,
                    channelId: dbEntry.channelId,
                    tags: taglist
                }
            } else {
                dbEntry.intervalCron = cron;
                job = {
                    type: "cron",
                    tags: taglist,
                    channelId: dbEntry.channelId,
                    cron
                }
            }

            await db.insert(jobTable).values(dbEntry);
            jobs.push(job);

            interaction.reply({
                content: `secondsDelay: ${secondsDelay}`,
                flags: MessageFlagsBitField.Flags.Ephemeral
            });
        } catch(e: any) {
            if (e instanceof Error) {
                console.error(e);
                interaction.reply({
                    content: `Error: ${e.message}`,
                    flags: MessageFlagsBitField.Flags.Ephemeral
                });
            }
        }
    }
}
