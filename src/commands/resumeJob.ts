import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { ADMIN_PERMISSION_BIT } from "../lib/consts";
import { setJobPaused } from "../lib/jobStore";
import { logger } from "../lib/logger";

const data = new SlashCommandBuilder()
    .setName('resumejob')
    .setDescription('Resume a paused job.')
    .setDefaultMemberPermissions(1 << ADMIN_PERMISSION_BIT)
    .addIntegerOption(option =>
        option.setName("id")
            .setDescription("ID of the job you want to resume.")
            .setRequired(true)
    );

export default {
    data,
    async execute(interaction: ChatInputCommandInteraction) {
        return setJobPaused(interaction, false).catch(error => {
            logger.error(error);
        });
    }
};
