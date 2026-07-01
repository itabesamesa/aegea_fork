import { CacheType, ChatInputCommandInteraction, Client, Collection, Events, GatewayIntentBits, MessageFlagsBitField } from 'discord.js';
import { discordToken } from '../lib/env';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getJobs, setupDb } from '../lib/dbScripts';
import { createJobTaskIfNotPaused } from '../lib/jobStore';
import { logger } from '../lib/logger';

type ActualClient = Client<boolean> & {
    commands: Collection<string, { execute: (x: ChatInputCommandInteraction<CacheType>) => Promise<void> }>
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
const client = new Client({ intents: [GatewayIntentBits.Guilds] }) as ActualClient;

client.commands = new Collection();
const COMMAND_DIR_PATH = './src/commands';
const commandFiles = readdirSync(COMMAND_DIR_PATH).filter(file => file.endsWith('.ts'));

await setupDb();
logger.info("Interval Types written to DB.");

for (const file of commandFiles) {
    const filePath = join('../commands', file);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const {default: command} = await import(filePath);
    if ('data' in command && 'execute' in command) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        client.commands.set(command.data.name, command);
    } else {
        logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.on(Events.InteractionCreate, interaction => {
    if (!interaction.isChatInputCommand()) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const command = (interaction.client as ActualClient).commands.get(interaction.commandName);

    if (!command) {
        logger.error('No command matching ${interaction.commandName} was found.');
        return;
    }

    command.execute(interaction).catch(error => {
        logger.error(error);
        interaction.reply({
            content: 'There was an error while executing this command!',
            flags: MessageFlagsBitField.Flags.Ephemeral
        }).catch(error2 => {
            logger.error(error2);
        });
    });
});

client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Ready! Logged in as ${readyClient.user.tag}`);
    getJobs().then(jobs => {
        logger.info("Jobs loaded:", jobs);
        for (const job of jobs) {
            createJobTaskIfNotPaused(readyClient, job);
        }
        logger.info("Job timeouts created!");
    }).catch(error => {
        logger.error(error);
    });
});

client.login(discordToken).catch(error => {
    logger.error(error);
});
