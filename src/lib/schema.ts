import { sqliteTable, text, int, primaryKey } from "drizzle-orm/sqlite-core";

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
    cronTimeZone: text("cron_time_zone"),
    message: text("message").default("").notNull(),
    catchupLimit: int("catchup_limit").default(1).notNull(),
    paused: int({ mode: "boolean" }).default(false).notNull()
});

export const postTable = sqliteTable("post", {
    id: int("id").primaryKey({autoIncrement: true}),
    sitePostId: int("site_post_id").notNull().unique()
});

export const sentTable = sqliteTable("sent", {
    jobId: int("job_id").notNull().references(() => jobTable.id),
    postId: int("post_id").notNull().references(() => postTable.id),
    timestamp: int("timestamp").notNull()
}, (table) => [
    primaryKey({columns: [table.jobId, table.postId]})
]);
