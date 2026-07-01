import { ChatInputCommandInteraction, Client, MessageFlagsBitField } from "discord.js";
import { IntervalTypes } from "./intervals";
import { catchUpOnPosts, sendPost } from "./post";
import { jobTable } from "./schema";
import { MILISECONDS_PER_SECOND } from "./consts";
import { eq } from "drizzle-orm";
import { findJobById } from "./dbScripts";
import { db } from "./env";
import { logger } from "./logger";

export type Job = Omit<typeof jobTable.$inferSelect, 'intervalType'> & { intervalType: IntervalTypes };
export type JobTask = {
    jobId: number,
    timeout: NodeJS.Timeout,
    interval: NodeJS.Timeout | null
}

export const jobTasks: JobTask[] = [];

export function jobToString(job: Job, showChannel: boolean) {
    let string = "";
    string += `ID: ${job.id}; `;
    string += `Tags: \`${job.tagList}\`; `;
    string += `Message: ${job.message}; `;
    string += `Start time: <t:${Math.round(job.timestamp / MILISECONDS_PER_SECOND)}>; `;
    string += `Interval: ${job.intervalSeconds || job.intervalCron}${job.intervalType === IntervalTypes.seconds ? 's' : ''}; `;
    string += `Catchup Limit: ${job.catchupLimit}; `;
    string += `Paused: ${job.paused}; `;
    string += `Created by: <@${job.userId}>; `;
    if (showChannel) {
        string += `Channel: <#${job.channelId}>;`;
    }
    return string;
}

export function createJobTaskIfNotPaused(client: Client<true>, job: Job,
        options: {
            initialDelay?: number,
            checkCatchUp?: boolean
        } = {
            checkCatchUp: true
        }
    ) {
    if (job.paused) {
        logger.info(`Job ${job.id} is paused, not creating task.`);
        return;
    }
    
    if (options.checkCatchUp) {
        catchUpOnPosts(client, job).catch(error => {
            logger.error(error);
        });
    }

    const callback = () => {
        sendPost(client, job).catch(e => {
            logger.error(e);
        });
    };
    
    if (job.intervalType === IntervalTypes.seconds) {
        const currentTime = Date.now();
        const msInterval = job.intervalSeconds! * MILISECONDS_PER_SECOND;
        const nextPostTimestamp = job.timestamp + msInterval * Math.ceil((currentTime - job.timestamp) / msInterval);
        const msToNextPost = nextPostTimestamp - currentTime;

        const task: JobTask = {
            jobId: job.id,
            timeout: setTimeout(() => {
                callback();
                task.interval = setInterval(callback, msInterval);
            }, options.initialDelay !== undefined ? 0 : msToNextPost),
            interval: null,
        };
        jobTasks.push(task);
    } else if (job.intervalType === IntervalTypes.cron) {
        throw Error("Not yet implemented.");
    }
}

export function clearJobTask(jobId: number) {
    const jobTask = jobTasks.find(j => j.jobId === jobId);
    if (jobTask) {
        clearTimeout(jobTask.timeout);
        if (jobTask.interval) {
            clearInterval(jobTask.interval);
        }
    }
}

export async function setJobPaused(interaction: ChatInputCommandInteraction, paused: boolean) {
    const id = interaction.options.getInteger('id')!;
    const job = await findJobById(id);

    if (job?.guildId !== interaction.guildId) {
        return interaction.reply({
            content: `Couldn't find job with ID ${id}.`,
            flags: MessageFlagsBitField.Flags.Ephemeral
        });
    }

    if (job.paused === paused) {
        return interaction.reply({
            content: `Job is already ${paused ? "paused" : "active"}.`,
            flags: MessageFlagsBitField.Flags.Ephemeral
        });
    }

    const updatedJob = (await db.update(jobTable).set({ paused }).where(eq(jobTable.id, id)).returning()).at(0);
    if (!updatedJob) {
        return interaction.reply({
            content: "Something went wrong.",
            flags: MessageFlagsBitField.Flags.Ephemeral
        });
    }

    clearJobTask(job.id);
    createJobTaskIfNotPaused(interaction.client, updatedJob, { checkCatchUp: false });

    return interaction.reply({
        content: `Successfully ${paused ? "paused" : "resumed"} job: ${jobToString(updatedJob, false)}`,
        flags: MessageFlagsBitField.Flags.Ephemeral
    });
}