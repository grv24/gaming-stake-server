import cron from "node-cron";
import { fetchAndUpdateCasinoOdds } from "../services/casino/CasinoService";
import { CASINO_TYPES } from "../Helpers/Request/Validation";

let cronJobsStarted = false;

export const startCasinoCronJobs = () => {
  // Prevent multiple starts
  if (cronJobsStarted) {
    console.log("[CRON] Casino cron jobs already started");
    return;
  }
  
  cronJobsStarted = true;
  console.log("[CRON] Starting casino cron jobs...");
  
  CASINO_TYPES.forEach((casinoType) => {
    cron.schedule("*/5 * * * * *", async () => {
      await fetchAndUpdateCasinoOdds(casinoType);
    });
    // console.log(`[CRON] Scheduled job for ${casinoType}`);
  });
};
