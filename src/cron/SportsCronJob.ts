import cron from 'node-cron';
import { processOddsData } from '../services/sports/OddsService';

// List of events to monitor (starts with some examples, grows as users request events)
let eventsToMonitor: any = [];

// Cron job to fetch data every second for all events
cron.schedule('* * * * * *', async () => {
  if (eventsToMonitor.length === 0) {
    return;
  }

  console.log(`[CRON] Processing ${eventsToMonitor.length} events`);
  
  // Process all events in parallel
  await Promise.all(
    eventsToMonitor.map((event: { sportId: string; eventId: string; }) => 
      processOddsData(event.sportId, event.eventId)
    )
  );
});

console.log('Odds cron job started');

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