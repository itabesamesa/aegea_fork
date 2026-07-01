import { REST, RESTPostAPIChatInputApplicationCommandsJSONBody, Routes } from "discord.js";
import { clientId, discordToken } from "../lib/env";
import { readdirSync } from "node:fs";
import { logger } from "../lib/logger";

const COMMAND_DIR_PATH = './src/commands';

const commands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
const commandFiles = readdirSync(COMMAND_DIR_PATH).filter(file => file.endsWith('.ts'));

for (const file of commandFiles) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { default: command } = await import(`../commands/${file}`);
    try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        commands.push(command.data.toJSON());
    } catch {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        commands.push(command.data);
    }
}

const rest = new REST({version:'10'}).setToken(discordToken);

await (async () => {
    try {
		logger.info(`Started refreshing ${commands.length} application (/) commands.`);

		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
		const data = await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands },
		) as unknown[];

		logger.info(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		logger.error(error);
	}
})();
