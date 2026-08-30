/**
 * Device calendar (EventKit / CalendarProvider) integration via
 * react-native-calendar-events. Meetings become "time block" planner items.
 */
let RNCalendarEvents: any = null;
try {
  const mod = require('react-native-calendar-events');
  RNCalendarEvents = mod.default ?? mod;
} catch {
  RNCalendarEvents = null;
}

export type DeviceCalendarBlock = {
  externalId: string;
  title: string;
  /** "09:30–10:30" or '' for all-day */
  time: string;
};

export const calendarAvailable = (): boolean =>
  typeof RNCalendarEvents?.requestPermissions === 'function';

export const connectCalendar = async (): Promise<boolean> => {
  if (!calendarAvailable()) {
    return false;
  }
  try {
    const status = await RNCalendarEvents.requestPermissions();
    return status === 'authorized';
  } catch {
    return false;
  }
};

const hhmm = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes(),
  ).padStart(2, '0')}`;
};

/** Events for a local calendar day, mapped to time blocks. */
export const fetchBlocksForDate = async (
  date: Date,
): Promise<DeviceCalendarBlock[]> => {
  if (!calendarAvailable()) {
    return [];
  }
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  try {
    const events = await RNCalendarEvents.fetchAllEvents(
      start.toISOString(),
      end.toISOString(),
    );
    return (events ?? []).map((e: any) => ({
      externalId: String(e.id),
      title: e.title || 'Busy',
      time: e.allDay ? '' : `${hhmm(e.startDate)}–${hhmm(e.endDate)}`,
    }));
  } catch {
    return [];
  }
};
