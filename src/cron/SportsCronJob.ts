import cron from 'node-cron';
import { processOddsData } from '../services/sports/OddsService';

// List of events to monitor (starts with some examples, grows as users request events)
let eventsToMonitor: any = [];

// Cron job to fetch data every 30 seconds for all events (instead of every second)
export const startSportCronJobs = () => {
  cron.schedule('*/30 * * * * *', async () => {
    if (eventsToMonitor.length === 0) {
      return;
    }

    console.log(`[CRON] Processing ${eventsToMonitor.length} events`);

    try {
      // Process all events in parallel with timeout
      const promises = eventsToMonitor.map((event: { sportId: string; eventId: string; }) =>
        Promise.race([
          processOddsData(event.sportId, event.eventId),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), 10000) // 10 second timeout
          )
        ]).catch(error => {
          console.error(`[CRON] Error processing event ${event.sportId}:${event.eventId}:`, error.message);
          return null;
        })
      );

      await Promise.all(promises);
    } catch (error) {
      console.error('[CRON] Error in sports cron job:', error);
    }
  });
}

console.log('Odds cron job started (30-second interval)');

// Function to add event to monitoring if not already present
export const addEventToMonitor = (sportId: string, eventId: string): boolean => {
  const eventKey = `${sportId}:${eventId}`;
  const exists = eventsToMonitor.some((e: { sportId: any; eventId: any; }) => `${e.sportId}:${e.eventId}` === eventKey);

  if (!exists) {
    eventsToMonitor.push({ sportId, eventId });
    console.log(`[CRON] Added event to monitor: sport ${sportId}, event ${eventId}`);
    return true;
  }

  return false;
};

// Function to remove event from monitoring
export const removeEventFromMonitor = (sportId: string, eventId: string): boolean => {
  const initialLength = eventsToMonitor.length;
  eventsToMonitor = eventsToMonitor.filter((e: { sportId: string; eventId: string; }) =>
    !(e.sportId === sportId && e.eventId === eventId)
  );

  const removed = initialLength !== eventsToMonitor.length;
  if (removed) {
    console.log(`[CRON] Removed event from monitor: sport ${sportId}, event ${eventId}`);
  }

  return removed;
};

// Function to get all monitored events
export const getMonitoredEvents = () => {
  return [...eventsToMonitor];
};

// Function to check if event is being monitored
export const isEventMonitored = (sportId: string, eventId: string): boolean => {
  return eventsToMonitor.some((e: { sportId: string; eventId: string; }) => e.sportId === sportId && e.eventId === eventId);
};