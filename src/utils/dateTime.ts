export const PHILIPPINE_TIME_ZONE = "Asia/Manila";
const PHILIPPINE_UTC_OFFSET = "+08:00";

export function getPhilippineDateParts(date: Date = new Date()) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: PHILIPPINE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

export function getPhilippineDateInputValue(date: Date = new Date()) {
  const { year, month, day } = getPhilippineDateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getPhilippineDayNumber(date: Date = new Date()) {
  const { year, month, day } = getPhilippineDateParts(date);
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

export function formatPhilippineDate(value: string | Date | number) {
  const date = value instanceof Date || typeof value === "number"
    ? new Date(value)
    : /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00${PHILIPPINE_UTC_OFFSET}`)
      : new Date(value);
  return date.toLocaleDateString("en-PH", { timeZone: PHILIPPINE_TIME_ZONE, year: "numeric", month: "long", day: "numeric" });
}

export function formatPhilippineDateTime(value: string | Date | number) {
  return new Date(value).toLocaleString("en-PH", { timeZone: PHILIPPINE_TIME_ZONE, year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function toPhilippineDateTimeInput(value: string) {
  const date = new Date(value);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: PHILIPPINE_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function philippineDateTimeInputToISOString(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) {
    throw new Error("Choose a valid Philippine date and time.");
  }
  return new Date(`${value}:00${PHILIPPINE_UTC_OFFSET}`).toISOString();
}

export function philippineEndOfDay(value: string) {
  return new Date(`${value}T23:59:59${PHILIPPINE_UTC_OFFSET}`);
}
