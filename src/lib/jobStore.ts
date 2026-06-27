import { Client } from "discord.js";
import { IntervalTypes } from "./intervals";
import { catchUpOnPosts, sendPost } from "./post";
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
    string += `Message: ${job.message}; `;
    string += `Start time: <t:${Math.round(job.timestamp / MILISECONDS_PER_SECOND)}>; `;
    string += `Interval: ${job.intervalSeconds || job.intervalCron}${job.intervalType === IntervalTypes.seconds ? 's' : ''}; `;
    string += `Catchup Limit: ${job.catchupLimit}; `;
    string += `Created by: <@${job.userId}>; `;
    if (showChannel) {
        string += `Channel: <#${job.channelId}>;`;
    }
    return string;
}

export function createJobTask(client: Client<true>, job: Job,
        options: {
            initialDelay?: number,
            checkCatchUp?: boolean
        } = {
            checkCatchUp: true
        }
    ) {
    if (options.checkCatchUp) {
        catchUpOnPosts(client, job).catch(error => {
            console.error(error);
        });
    }

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
