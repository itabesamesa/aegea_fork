import { CacheType, ChatInputCommandInteraction, Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import { discordToken } from '../lib/env';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { getJobs, setupDb } from '../lib/dbScripts';
import { createJobTask } from '../lib/jobStore';

type ActualClient = Client<boolean> & {
    commands: Collection<string, { execute: (x: ChatInputCommandInteraction<CacheType>) => Promise<void> }>
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
const client = new Client({ intents: [GatewayIntentBits.Guilds] }) as ActualClient;

client.commands = new Collection();
const COMMAND_DIR_PATH = './src/commands';
const commandFiles = readdirSync(COMMAND_DIR_PATH).filter(file => file.endsWith('.ts'));

await setupDb();
console.log("Interval Types written to DB.");

for (const file of commandFiles) {
    const filePath = join('../commands', file);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const {default: command} = await import(filePath);
    if ('data' in command && 'execute' in command) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.on(Events.InteractionCreate, interaction => {
    if (!interaction.isChatInputCommand()) return;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const command = (interaction.client as ActualClient).commands.get(interaction.commandName);

    if (!command) {
        console.error('No command matching ${interaction.commandName} was found.');
        return;
    }

    command.execute(interaction).catch(error => {
        console.error(error);
        interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true}).catch(error2 => {
            console.error(error2);
        });
    });
});

client.once(Events.ClientReady, (readyClient) => {
    console.log(`Ready! Logged in as ${readyClient.user.tag}`);
    getJobs().then(jobs => {
        console.log("Jobs loaded:", jobs);
        for (const job of jobs) {
            createJobTask(readyClient, job);
        }
        console.log("Job timeouts created!");
    }).catch(error => {
        console.error(error);
    });
});

client.login(discordToken).catch(error => {
    console.error(error);
});
