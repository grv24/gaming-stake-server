import cron from "node-cron";
// import { fetchAndUpdateCasinoOdds, getPriorityCasinoTypes, clearPriorityQueue } from "../services/casino/CasinoService";
import { getPriorityCasinoTypes, clearPriorityQueue } from "../services/casino/CasinoService";
import { CASINO_TYPES } from "../Helpers/Request/Validation";

let cronJobsStarted = false;

// Smart staggering configuration for 10-second intervals
const STAGGER_DELAY = 500; // Reduced to 500ms between casino types
const CRON_INTERVAL = "*/10 * * * * *"; // Keep 10 seconds for real-time odds
const BATCH_SIZE = 5; // Process casino types in batches

export const startCasinoCronJobs = () => {
  // Prevent multiple starts
  if (cronJobsStarted) {
    console.log("[CRON] Casino cron jobs already started");
    return;
  }
  
  cronJobsStarted = true;
  console.log("[CRON] Starting casino cron jobs with smart batching...");
  
  // Create a single cron job that handles all casino types with priority system
  cron.schedule(CRON_INTERVAL, async () => {
    console.log(`[CRON] Starting casino odds update cycle for ${CASINO_TYPES.length} casino types`);
    
    // Step 1: Process priority casino types immediately (user-requested)
    const priorityTypes = getPriorityCasinoTypes();
    if (priorityTypes.length > 0) {
      console.log(`[CRON] Processing ${priorityTypes.length} priority casino types first`);
      
      const priorityPromises = priorityTypes.map(async (casinoType, index) => {
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY));
        }
        
        try {
          // await fetchAndUpdateCasinoOdds(casinoType);
          console.log(`[CRON] Skipping ${casinoType} - fetchAndUpdateCasinoOdds is disabled`);
        } catch (error: any) {
          console.error(`[CRON] Error processing priority ${casinoType}:`, error.message);
        }
      });
      
      await Promise.allSettled(priorityPromises);
      clearPriorityQueue();
    }
    
    // Step 2: Process remaining casino types in batches
    const remainingTypes = CASINO_TYPES.filter(type => !priorityTypes.includes(type));
    
    if (remainingTypes.length > 0) {
      console.log(`[CRON] Processing ${remainingTypes.length} remaining casino types in batches`);
      
      // Process remaining casino types in batches to prevent API overload
      const batches = [];
      for (let i = 0; i < remainingTypes.length; i += BATCH_SIZE) {
        batches.push(remainingTypes.slice(i, i + BATCH_SIZE));
      }
      
      // Process each batch with parallel execution within batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // Process batch in parallel (within batch) but with small delays
        const batchPromises = batch.map(async (casinoType, index) => {
          // Small delay within batch to prevent overwhelming
          if (index > 0) {
            await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY));
          }
          
          try {
            // await fetchAndUpdateCasinoOdds(casinoType);
            console.log(`[CRON] Skipping ${casinoType} - fetchAndUpdateCasinoOdds is disabled`);
          } catch (error: any) {
            console.error(`[CRON] Error processing ${casinoType}:`, error.message);
          }
        });
        
        // Wait for current batch to complete before starting next batch
        await Promise.allSettled(batchPromises);
        
        // Small delay between batches (except for the last batch)
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, STAGGER_DELAY * 2));
        }
      }
    }
    
    console.log(`[CRON] Completed casino odds update cycle`);
  });
  
  console.log(`[CRON] Scheduled casino cron job with ${CRON_INTERVAL} interval, ${BATCH_SIZE} batch size, and ${STAGGER_DELAY}ms stagger`);
};
