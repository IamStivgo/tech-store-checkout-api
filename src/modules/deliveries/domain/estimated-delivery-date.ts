const SUNDAY = 0;
const SATURDAY = 6;
const MS_PER_DAY = 86_400_000;
// Deliveries are promised in Colombian calendar days.
const STORE_TIME_ZONE = 'America/Bogota';
const dateInStore = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * `YYYY-MM-DD` of the day `businessDays` business days after `from` in Colombia, skipping
 * weekends (public holidays are not modeled).
 */
export const estimatedDeliveryDate = (from: Date, businessDays: number): string => {
  const date = new Date(`${dateInStore.format(from)}T00:00:00.000Z`);
  let remaining = businessDays;
  while (remaining > 0) {
    date.setTime(date.getTime() + MS_PER_DAY);
    const weekday = date.getUTCDay();
    if (weekday !== SUNDAY && weekday !== SATURDAY) {
      remaining -= 1;
    }
  }
  return date.toISOString().slice(0, 10);
};
