import { Client } from "discord.js";
import { fetchRandomPost } from "./safebooruApi";
import { Job } from "./jobStore";
import { postTable, sentTable } from "./schema";
import { db } from "./env";
import { findPostBySitePostId, findSentPostsByJob } from "./dbScripts";

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
        await db.insert(sentTable).values({ jobId: job.id, postId });

        return channel.send({
            content: `${job.message}\n[[source](<${attachment.source}>)] [[link](<${attachment.postUrl}>)] [ [file](${attachment.fileUrl}) ]`
        });
    }
}
