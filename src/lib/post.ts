import { Client } from "discord.js";
import { fetchRandomPost } from "./safebooruApi";
import { Job } from "./jobStore";
import { postTable, sentTable } from "./schema";
import { db } from "./env";
import { countSentPostsBetweenTimes, findPostBySitePostId, findSentPostsByJob } from "./dbScripts";
import { IntervalTypes } from "./intervals";
import { MILISECONDS_PER_SECOND } from "./consts";
import { logger } from "./logger";

export async function sendPost(client: Client<true>, job: Job) {
    const channel = await client.channels.fetch(job.channelId);
    if (channel?.isSendable()) {
        const sentIds = await findSentPostsByJob(job.id);
        const sentPostIds = new Set(sentIds.map((s) => s.sitePostId));

        const attachment = await fetchRandomPost(job.tagList, sentPostIds);
        if (!attachment) {
            return channel.send({
                content: `Could not find new post with tags \`${job.tagList}\` :c Maybe we're all outta posts?`,
            });
        }

        let dbPost = await findPostBySitePostId(attachment.postId);
        if (dbPost.length === 0) {
            dbPost = await db.insert(postTable).values({ sitePostId: attachment.postId }).returning();
        }
        const postId = dbPost[0].id;
        await db.insert(sentTable).values({ jobId: job.id, postId, timestamp: Date.now() });

        return channel.send({
            content: `${job.message}\n[[source](<${attachment.source}>)] [[link](<${attachment.postUrl}>)] [ [file](${attachment.fileUrl}) ]`
        });
    }
}

export async function catchUpOnPosts(client: Client<true>, job: Job) {
    if (job.intervalType !== IntervalTypes.seconds) return;

    let limit = job.catchupLimit;
    for (let i = 0; i < limit; i++) {
        const msInterval = job.intervalSeconds! * MILISECONDS_PER_SECOND;
        const referenceTime = Date.now() - msInterval * i;
        if (referenceTime < job.timestamp) {
            break;
        }

        const nextPostTimestamp = job.timestamp + msInterval * Math.ceil((referenceTime - job.timestamp) / msInterval);
        const expectedPreviousPostTimeStamp = nextPostTimestamp - msInterval;

        try {
            const count = await countSentPostsBetweenTimes(job.id, expectedPreviousPostTimeStamp, nextPostTimestamp);
            if (count === 0) {
                sendPost(client, job).catch(error => {
                    logger.error(error);
                });
            } else if (count) {
                limit -= count - 1;
            }
        }
        catch (error) {
            logger.error(error);
        };
    }
}
