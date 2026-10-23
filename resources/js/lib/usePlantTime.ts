import { useWorkspace } from './workspace';
import { formatDate, fromLocalInput, toLocalInput, todayInZone, timeZoneLabel } from './time';

export function usePlantTime() {
  const { timeZone } = useWorkspace();
  return {
    timeZone,
    zoneLabel: timeZoneLabel(timeZone),
    date: (value: string, options?: Intl.DateTimeFormatOptions) =>
      formatDate(value, timeZone, options),
    shortDate: (value: string) => formatDate(value, timeZone, { day: '2-digit', month: 'short' }),
    today: () => todayInZone(timeZone),
    iso: (value: string) => fromLocalInput(value, timeZone),
    toLocal: (value: string) => toLocalInput(value, timeZone),
    localTime: (value?: string) =>
      value ? toLocalInput(value, timeZone) : `${todayInZone(timeZone)}T07:00:00`,
  };
}
