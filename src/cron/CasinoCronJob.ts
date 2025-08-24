import cron from "node-cron";
import { fetchAndUpdateCasinoOdds } from "../services/casino/CasinoService";
import { CASINO_TYPES } from "../Helpers/Request/Validation";

export const startCasinoCronJobs = () => {
  // Configurable interval - default to every second, but can be changed via environment
  const interval = process.env.CASINO_CRON_INTERVAL || "* * * * * *"; // Every second by default
  
  // Run casino cron jobs with configurable interval
  cron.schedule(interval, async () => {
    console.log(`[CRON] Starting casino cron job for ${CASINO_TYPES.length} casino types`);
    
    try {
      // Process casino types in smaller batches to handle every-second execution
      const batchSize = 3; // Reduced batch size for faster processing
      
      for (let i = 0; i < CASINO_TYPES.length; i += batchSize) {
        const batch = CASINO_TYPES.slice(i, i + batchSize);
        
        const promises = batch.map(async (casinoType) => {
          try {
            // Add shorter timeout for every-second execution
            const result = await Promise.race([
              fetchAndUpdateCasinoOdds(casinoType),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 8000) // 8 second timeout
              )
            ]);
            return { casinoType, success: true, result };
          } catch (error: any) {
            console.error(`[CRON] Error processing casino type ${casinoType}:`, error);
            return { casinoType, success: false, error: error.message };
          }
        });
        
        await Promise.all(promises);
        
        // Minimal delay between batches for every-second execution
        if (i + batchSize < CASINO_TYPES.length) {
          await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        }
      }
      
      console.log(`[CRON] Completed casino cron job for all ${CASINO_TYPES.length} casino types`);
    } catch (error) {
      console.error('[CRON] Error in casino cron job:', error);
    }
  });
  
  console.log(`[CRON] Scheduled casino cron job (${interval} interval) for ${CASINO_TYPES.length} casino types`);
  
  if (interval === "* * * * * *") {
    console.log(`⚠️  WARNING: Every-second execution may impact performance. Monitor system resources.`);
    console.log(`💡 To change interval, set CASINO_CRON_INTERVAL environment variable.`);
    console.log(`   Examples: "*/30 * * * * *" (30 seconds), "*/2 * * * *" (2 minutes)`);
  }
};
