import { sql } from "drizzle-orm";
import { sqliteTable, text, int, check, primaryKey } from "drizzle-orm/sqlite-core";

export const intervalTypeTable = sqliteTable("interval_type", {
    id: int("id").primaryKey({autoIncrement: true}),
    label: text("label").notNull().unique()
});

export const jobTable = sqliteTable("job", {
    id: int("id").primaryKey({autoIncrement: true}),
    guildId: text("guild_id").notNull(),
    channelId: text("channel_id").notNull(),
    userId: text("user_id").notNull(),
    timestamp: int("timestamp").notNull(),
    tagList: text("tag_list").notNull(),
    intervalType: int("interval_type_id").notNull().references(() => intervalTypeTable.id),
    intervalSeconds: int("interval_seconds"),
    intervalCron: text("interval_cron"),
    message: text("message").default("").notNull()
}, (table) => [
    check("one_interval_given_check", sql`(${table.intervalSeconds} IS NOT NULL AND ${table.intervalCron} IS NULL) OR (${table.intervalSeconds} IS NULL AND ${table.intervalCron} IS NOT NULL)`)
]);

export const postTable = sqliteTable("post", {
    id: int("id").primaryKey({autoIncrement: true}),
    sitePostId: int("site_post_id").notNull().unique()
});

export const sentTable = sqliteTable("sent", {
    jobId: int("job_id").notNull().references(() => jobTable.id),
    postId: int("post_id").notNull().references(() => postTable.id)
}, (table) => [
    primaryKey({columns: [table.jobId, table.postId]})
]);
