import cron from 'node-cron';
import { processOddsData } from '../services/sports/OddsService';
import { fetchAndStoreSportsData } from '../services/sports/SportService';

let eventsToMonitor: { sportId: string; eventId: string }[] = [];


export const startLiveMatchesCron = () => {
  cron.schedule("*/3 * * * *", async () => {
    try {
      console.log("[CRON] Fetching live matches...");

      const newEvents: { sportId: string; eventId: string }[] = [];

      // Cricket - Direct array access
      try {
        const cricketMatches = await fetchAndStoreSportsData("cricket");
        if (cricketMatches && Array.isArray(cricketMatches)) {
          cricketMatches.forEach((m: any) => {
            if (m.iplay && m.gmid) {
              newEvents.push({ sportId: "4", eventId: m.gmid });
            }
          });
          console.log(`[CRON] Cricket: Found ${cricketMatches.filter((m: any) => m.iplay).length} live matches`);
        } else {
          console.log("[CRON] Cricket: No data or invalid format");
        }
      } catch (err: any) {
        console.error("[CRON] Cricket fetch error:", err.message);
      }

      // Soccer - Nested data access
      try {
        const soccerMatches = await fetchAndStoreSportsData("soccer");
        if (soccerMatches?.success && soccerMatches?.data?.t1 && Array.isArray(soccerMatches.data.t1)) {
          soccerMatches.data.t1.forEach((m: any) => {
            if (m.iplay && m.gmid) {
              newEvents.push({ sportId: "1", eventId: m.gmid });
            }
          });
          console.log(`[CRON] Soccer: Found ${soccerMatches.data.t1.filter((m: any) => m.iplay).length} live matches`);
        } else {
          console.log("[CRON] Soccer: No data or invalid format");
        }
      } catch (err: any) {
        console.error("[CRON] Soccer fetch error:", err.message);
      }

      // Tennis - Nested data access
      try {
        const tennisMatches = await fetchAndStoreSportsData("tennis");
        if (tennisMatches?.success && tennisMatches?.data?.t1 && Array.isArray(tennisMatches.data.t1)) {
          tennisMatches.data.t1.forEach((m: any) => {
            if (m.iplay && m.gmid) {
              newEvents.push({ sportId: "2", eventId: m.gmid });
            }
          });
          console.log(`[CRON] Tennis: Found ${tennisMatches.data.t1.filter((m: any) => m.iplay).length} live matches`);
        } else {
          console.log("[CRON] Tennis: No data or invalid format");
        }
      } catch (err: any) {
        console.error("[CRON] Tennis fetch error:", err.message);
      }

      eventsToMonitor = newEvents;

      console.log(`[CRON] Total live events stored: ${eventsToMonitor.length}`);
      if (eventsToMonitor.length > 0) {
        console.log(`[CRON] Events to monitor:`, eventsToMonitor.map(e => `${e.sportId}:${e.eventId}`).join(', '));
      }

    } catch (err: any) {
      console.error("[CRON] Failed to fetch live matches:", err.message);
    }
  });
};

export const startOddsCron = () => {
  cron.schedule("*/10 * * * * *", async () => {
    try {
      if (eventsToMonitor.length === 0) {
        console.log("[ODDS-CRON] Live matches array empty.");
        return;
      }

      console.log(`[ODDS-CRON] Fetching odds for ${eventsToMonitor.length} events`);

      await Promise.allSettled(
        eventsToMonitor.map((m) => processOddsData(m.sportId, m.eventId))
      );
    } catch (err: any) {
      console.error("[ODDS-CRON] Error:", err.message);
    }
  });
};

export const startSportsCrons = () => {
  startLiveMatchesCron();
  startOddsCron();
};
