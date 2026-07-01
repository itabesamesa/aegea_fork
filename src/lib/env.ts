import { config } from "dotenv";
import { drizzle } from "drizzle-orm/libsql";
config();

const discordTokenUnsure = process.env.DISCORD_TOKEN;
if (!discordTokenUnsure) {
    throw new Error("Could not find DISCORD_TOKEN in .env");
}
export const discordToken = discordTokenUnsure;

const clientIdUnsure = process.env.CLIENT_ID;
if (!clientIdUnsure) {
    throw new Error("Could not find CLIENT_ID in .env");
}
export const clientId = clientIdUnsure;

export const db = drizzle(process.env.DB_FILE_NAME!);

export const logDir = process.env.LOG_DIR || "logs";
