import cron from "node-cron";
import { fetchAndUpdateCasinoOdds } from "../services/casino/CasinoService";

const CASINO_TYPES = ["lucky5"]; 

export const startCasinoCronJobs = () => {
  CASINO_TYPES.forEach((casinoType) => {
    
    cron.schedule("* * * * * *", async () => {
      await fetchAndUpdateCasinoOdds(casinoType);
    });
    console.log(`[CRON] Scheduled job for ${casinoType}`);
  });
};
