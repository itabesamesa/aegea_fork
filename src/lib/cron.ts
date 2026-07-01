import { CronJob } from "cron";

export enum CronValidationResult {
    "valid",
    "invalidCron",
    "invalidTimezone"
}

export function validateCron(cron: string, timezone?: string|null): CronValidationResult {
    try {
        new CronJob(cron, () => {return;});
    } catch {
        return CronValidationResult.invalidCron;
    }

    if (timezone) {
        try {
            new CronJob(cron, () => {return;}, null, null, timezone);
        } catch {
            return CronValidationResult.invalidTimezone;
        }
    }
    
    return CronValidationResult.valid;
}
