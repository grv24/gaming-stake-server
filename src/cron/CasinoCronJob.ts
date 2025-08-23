import cron from "node-cron";
import { fetchAndUpdateCasinoOdds } from "../services/casino/CasinoService";

const CASINO_TYPES = [
  "dt6",
  "teen",
  "poker",
  "teen20",
  "teen9",
  "teen8",
  "poker20",
  "poker6",
  "card32eu",
  "war",
  "aaa",
  "abj",
  "dt20",
  "lucky7eu",
  "dt202",
  "teenmuf",
  "joker20",
  "poison20",
  "joker1",
  "teen20c",
  "btable2",
  "goal",
  "ab4",
  "lottcard",
  "lucky5",
  "baccarat2"
];


export const startCasinoCronJobs = () => {
  CASINO_TYPES.forEach((casinoType) => {
    
    cron.schedule("* * * * * *", async () => {
      await fetchAndUpdateCasinoOdds(casinoType);
    });
    console.log(`[CRON] Scheduled job for ${casinoType}`);
  });
};
