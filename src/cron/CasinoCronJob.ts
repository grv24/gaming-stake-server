// import cron from "node-cron";
// import { fetchAndUpdateCasinoOdds } from "../services/casino/CasinoService";
// import { CASINO_TYPES } from "../Helpers/Request/Validation";

// let cronJobsStarted = false;

// export const startCasinoCronJobs = () => {
//   // Prevent multiple starts
//   if (cronJobsStarted) {
//     console.log("[CRON] Casino cron jobs already started");
//     return;
//   }
  
//   cronJobsStarted = true;
//   console.log("[CRON] Starting casino cron jobs...");
  
//   CASINO_TYPES.forEach((casinoType) => {
//     cron.schedule("*/11 * * * * *", async () => {
//       await fetchAndUpdateCasinoOdds(casinoType);
//     });
//     console.log(`[CRON] Scheduled job for ${casinoType}`);
//   });
// };

import cron from "node-cron";
import { fetchAndUpdateCasinoOdds } from "../services/casino/CasinoService";
import { CASINO_TYPES } from "../Helpers/Request/Validation";

let cronJobsStarted = false;

// Split into batches of N
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export const startCasinoCronJobs = () => {
  if (cronJobsStarted) {
    console.log("[CRON] Casino cron jobs already started");
    return;
  }

  cronJobsStarted = true;
  console.log("[CRON] Starting casino cron jobs...");

  // Split into batches of 8 (you can tune this number)
  const batches = chunkArray(CASINO_TYPES, 8);

  batches.forEach((batch, batchIndex) => {
    // Offset start times: 0s, 3s, 6s, etc.
    const offset = batchIndex * 3;

    cron.schedule("*/11 * * * * *", async () => {
      const sec = new Date().getSeconds(); 
      if (sec % 11 === offset) {
        console.log(`[CRON] Running batch ${batchIndex + 1} at second ${sec}`);
        await Promise.allSettled(
          batch.map((casinoType) => fetchAndUpdateCasinoOdds(casinoType))
        );
      }
    });

    console.log(
      `[CRON] Scheduled batch ${batchIndex + 1} with ${batch.length} casino types`
    );
  });
};
