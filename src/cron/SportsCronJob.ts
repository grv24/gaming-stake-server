import cron from 'node-cron';
import { processOddsData } from '../services/sports/OddsService';
import { fetchAndStoreSportsData } from '../services/sports/SportService';

let eventsToMonitor: { sportId: string; eventId: string }[] = [];


export const startLiveMatchesCron = () => {
  cron.schedule("*/3 * * * *", async () => {
    try {
      console.log("[CRON] Fetching live matches...");

      const newEvents: { sportId: string; eventId: string }[] = [];

      // Cricket
      const cricketMatches = await fetchAndStoreSportsData("cricket");
      cricketMatches?.forEach((m: any) => {
        if (m.iplay) {
          newEvents.push({ sportId: "4", eventId: m.gmid });
        }
      });

      // Soccer
      const soccerMatches = await fetchAndStoreSportsData("soccer");
      soccerMatches?.data?.t1?.forEach((m: any) => {
        if (m.iplay) {
          newEvents.push({ sportId: "1", eventId: m.gmid });
        }
      });

      // Tennis
      const tennisMatches = await fetchAndStoreSportsData("tennis");
      tennisMatches?.data?.t1?.forEach((m: any) => {
        if (m.iplay) {
          newEvents.push({ sportId: "2", eventId: m.gmid });
        }
      });

      eventsToMonitor = newEvents;

      console.log(`[CRON] Stored ${eventsToMonitor.length} live events`);

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
