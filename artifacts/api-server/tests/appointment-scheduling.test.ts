import { describe, expect, it } from "vitest";
import {
  isWithinProviderAvailability,
  localDateTimeToInstant,
  type ProviderSchedule,
} from "../src/routes/appointmentScheduling";

describe("appointment local-time scheduling", () => {
  it("converts provider-local time to an instant and rejects nonexistent DST times", () => {
    expect(
      localDateTimeToInstant("2026-11-15", "10:00", "America/Bogota")?.toISOString(),
    ).toBe("2026-11-15T15:00:00.000Z");
    expect(
      localDateTimeToInstant("2026-03-08", "02:30", "America/New_York"),
    ).toBeNull();
    expect(
      localDateTimeToInstant("2026-02-31", "10:00", "America/Bogota"),
    ).toBeNull();
  });

  it("requires the whole appointment to fit inside the effective local window", () => {
    const schedule: ProviderSchedule = {
      timezone: "America/Bogota",
      weeklyWindows: [{ dayOfWeek: 0, startTime: "09:00", endTime: "12:00" }],
      exceptions: [],
    };
    const withinWindow = localDateTimeToInstant(
      "2026-11-15",
      "11:30",
      schedule.timezone,
    );
    const exceedsWindow = localDateTimeToInstant(
      "2026-11-15",
      "11:45",
      schedule.timezone,
    );
    expect(withinWindow).not.toBeNull();
    expect(exceedsWindow).not.toBeNull();
    expect(isWithinProviderAvailability(schedule, withinWindow!, 30)).toBe(true);
    expect(isWithinProviderAvailability(schedule, exceedsWindow!, 30)).toBe(false);

    schedule.exceptions = [
      { date: "2026-11-15", isClosed: true, windows: [] },
    ];
    expect(isWithinProviderAvailability(schedule, withinWindow!, 30)).toBe(false);
  });
});
