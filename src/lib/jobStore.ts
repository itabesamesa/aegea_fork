import { Client } from "discord.js";
import { IntervalTypes } from "./intervals";
import { sendPost } from "./post";
import { jobTable } from "./schema";
import { MILISECONDS_PER_SECOND } from "./consts";

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
    string += `Interval: ${job.intervalSeconds || job.intervalCron}${job.intervalType === IntervalTypes.seconds ? 's' : ''}; `;
    string += `Created by: <@${job.userId}>; `;
    if (showChannel) {
        string += `Channel: <#${job.channelId}>;`;
    }
    return string;
}

export function createJobTask(client: Client<true>, job: Job, initialDelay: number | null = null) {
    const callback = () => {
        sendPost(client, job).catch(e => {
            console.error(e);
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
            }, initialDelay !== null ? 0 : msToNextPost),
            interval: null,
        };
        jobTasks.push(task);
    } else if (job.intervalType === IntervalTypes.cron) {
        throw Error("Not yet implemented.");
    }
}
