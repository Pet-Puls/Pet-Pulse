export interface ProviderSchedule {
  timezone: string;
  weeklyWindows: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  exceptions: Array<{
    date: string;
    isClosed: boolean;
    windows: Array<{ startTime: string; endTime: string }>;
  }>;
}

interface LocalDateTime {
  date: string;
  time: string;
  dayOfWeek: number;
}

const weekdayIndexes: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function formatLocalDateTime(date: Date, timezone: string): LocalDateTime | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
      hourCycle: "h23",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    const weekday = weekdayIndexes[values.weekday];
    if (weekday === undefined) {
      return null;
    }

    return {
      date: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}`,
      dayOfWeek: weekday,
    };
  } catch {
    return null;
  }
}

export function localDateTimeToInstant(
  date: string,
  time: string,
  timezone: string,
): Date | null {
  if (
    !isValidDateOnly(date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
  ) {
    return null;
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
  } catch {
    return null;
  }

  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const desiredLocalTime = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = desiredLocalTime;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const local = formatLocalDateTime(new Date(candidate), timezone);
    if (!local) {
      return null;
    }
    const [localYear, localMonth, localDay] = local.date.split("-").map(Number);
    const [localHour, localMinute] = local.time.split(":").map(Number);
    const representedLocalTime = Date.UTC(
      localYear,
      localMonth - 1,
      localDay,
      localHour,
      localMinute,
    );
    candidate = desiredLocalTime - (representedLocalTime - candidate);
  }

  const instant = new Date(candidate);
  const resolvedLocal = formatLocalDateTime(instant, timezone);
  if (
    !resolvedLocal ||
    resolvedLocal.date !== date ||
    resolvedLocal.time !== time ||
    instant.getUTCSeconds() !== 0 ||
    instant.getUTCMilliseconds() !== 0
  ) {
    return null;
  }
  return instant;
}

export function isWithinProviderAvailability(
  schedule: ProviderSchedule,
  startsAt: Date,
  durationMinutes: number,
): boolean {
  const localStart = formatLocalDateTime(startsAt, schedule.timezone);
  const localEnd = formatLocalDateTime(
    new Date(startsAt.getTime() + durationMinutes * 60_000),
    schedule.timezone,
  );
  if (!localStart || !localEnd || localStart.date !== localEnd.date) {
    return false;
  }

  const exception = schedule.exceptions.find(
    (candidate) => candidate.date === localStart.date,
  );
  const windows = exception
    ? exception.isClosed
      ? []
      : exception.windows
    : schedule.weeklyWindows
        .filter((window) => window.dayOfWeek === localStart.dayOfWeek)
        .map(({ startTime, endTime }) => ({ startTime, endTime }));

  return windows.some(
    (window) => localStart.time >= window.startTime && localEnd.time <= window.endTime,
  );
}
