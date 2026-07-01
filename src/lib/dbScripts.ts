import { and, count, eq, gte, lt } from "drizzle-orm";
import { db } from "./env";
import { createIntervalTypes } from "./intervals";
import { jobTable, postTable, sentTable } from "./schema";
import { clearJobTask } from "./jobStore";
import { logger } from "./logger";

export async function setupDb() {
    try {
        await createIntervalTypes();
    } catch (error) {
        logger.error(error);
    }
}

export async function getJobs() {
    return db.select().from(jobTable);
}

export async function findJobById(id: number) {
    return (await db.select().from(jobTable).where(eq(jobTable.id, id))).at(0);
}

export async function deleteJob(id: number) {
    try {
        await db.delete(sentTable).where(eq(sentTable.jobId, id));
        await db.delete(jobTable).where(eq(jobTable.id, id));
        clearJobTask(id);
    } catch (e: unknown) {
        logger.error(e);
        if (e instanceof Error) {
            return e;
        }
    }
}

export async function findJobsByServer(serverId: string) {
    return db.select().from(jobTable).where(eq(jobTable.guildId, serverId));
}

export async function findJobsByChannel(channelId: string) {
    return db.select().from(jobTable).where(eq(jobTable.channelId, channelId));
}

// in 1.0 it would be possible to just return 1 row but we're not in 1.0 so whatever
export async function findPostBySitePostId(sitePostId: number) {
    return db.select({id: postTable.id}).from(postTable).where(eq(postTable.sitePostId, sitePostId));
}

export async function findSent(jobId: number, postId: number) {
    return db.select().from(sentTable).where(and(eq(sentTable.jobId, jobId), eq(sentTable.postId, postId)));
}

export async function hasPostBeenSent(jobId: number, postId: number) {
    return (await db.select()
        .from(sentTable)
        .innerJoin(postTable, eq(postTable.id, sentTable.postId))
        .where(and(eq(sentTable.jobId, jobId), eq(postTable.sitePostId, postId)))
    ).length > 0;
}

export function findSentPostsByJob(jobId: number) {
    return db.select({
        id: postTable.id,
        sitePostId: postTable.sitePostId
    }).from(postTable).innerJoin(sentTable, eq(sentTable.postId, postTable.id)).where(eq(sentTable.jobId, jobId));
}

export async function countSentPostsBetweenTimes(jobId: number, milisecondsStart: number, milisecondsEnd: number) {
    return (await db.select({ count: count(sentTable.postId).as("count") })
        .from(sentTable)
        .where(and(
            eq(sentTable.jobId, jobId),
            gte(sentTable.timestamp, milisecondsStart),
            lt(sentTable.timestamp, milisecondsEnd)
        ))).at(0)?.count;
}
