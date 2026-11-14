import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const whereUpdate = vi.fn().mockResolvedValue([]);
  const whereSelect = vi.fn(() => ({
    orderBy: () => ({ limit: vi.fn().mockResolvedValue([]) }),
  }));
  const table = {
    channel: "channel",
    status: "status",
    updatedAt: "updatedAt",
    nextAttemptAt: "nextAttemptAt",
    recipientProfileId: "recipientProfileId",
    appointmentId: "appointmentId",
    createdAt: "createdAt",
  };
  return {
    whereUpdate,
    whereSelect,
    table,
    createGmail: vi.fn(() => ({
      username: "sender@example.com",
      fromName: "QA",
      testScope: {
        recipientProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        appointmentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        notBefore: new Date("2026-11-14T20:00:00.000Z"),
      },
      transport: { sendMail: vi.fn() },
    })),
  };
});

vi.mock("@workspace/db", () => ({
  appointmentNotificationsTable: mocks.table,
  userProfilesTable: {},
  db: {
    update: () => ({ set: () => ({ where: mocks.whereUpdate }) }),
    select: () => ({ from: () => ({ where: mocks.whereSelect }) }),
  },
}));
vi.mock("drizzle-orm", () => ({
  and: (...conditions: unknown[]) => ({ and: conditions.filter(Boolean) }),
  eq: (column: string, value: unknown) => ({ op: "eq", column, value }),
  gte: (column: string, value: unknown) => ({ op: "gte", column, value }),
  lte: (column: string, value: unknown) => ({ op: "lte", column, value }),
  lt: (column: string, value: unknown) => ({ op: "lt", column, value }),
  asc: (column: string) => column,
}));
vi.mock("../src/lib/gmailApiTransport", () => ({ createGmailApiTransport: mocks.createGmail }));
vi.mock("../src/lib/logger", () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

import { startAppointmentEmailWorker } from "../src/lib/appointmentEmailWorker";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("APPOINTMENT_EMAIL_TRANSPORT", "");
  vi.stubEnv("GMAIL_SMTP_USER", "");
  vi.stubEnv("GMAIL_SMTP_APP_PASSWORD", "");
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("appointment email worker", () => {
  it("does not start a worker when email is unconfigured", () => {
    startAppointmentEmailWorker();
    expect(mocks.whereUpdate).not.toHaveBeenCalled();
    expect(mocks.whereSelect).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects an unknown transport instead of starting delivery", () => {
    vi.stubEnv("APPOINTMENT_EMAIL_TRANSPORT", "unknown");
    expect(startAppointmentEmailWorker).toThrow("APPOINTMENT_EMAIL_TRANSPORT");
    expect(mocks.whereSelect).not.toHaveBeenCalled();
  });

  it("preserves the existing SMTP worker when its credentials are configured", async () => {
    vi.stubEnv("GMAIL_SMTP_USER", "sender@example.com");
    vi.stubEnv("GMAIL_SMTP_APP_PASSWORD", "test-password");
    startAppointmentEmailWorker();
    await vi.advanceTimersByTimeAsync(0);
    expect(mocks.createGmail).not.toHaveBeenCalled();
    expect(mocks.whereSelect).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(1);
  });

  it("limits recovery and delivery to the selected test recipient, appointment and cutoff", async () => {
    vi.stubEnv("APPOINTMENT_EMAIL_TRANSPORT", "gmail-api");
    startAppointmentEmailWorker();
    await vi.advanceTimersByTimeAsync(0);
    const scope = {
      and: [
        { op: "eq", column: "recipientProfileId", value: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
        { op: "eq", column: "appointmentId", value: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" },
        { op: "gte", column: "createdAt", value: new Date("2026-11-14T20:00:00.000Z") },
      ],
    };
    expect(mocks.whereUpdate).toHaveBeenCalledWith(expect.objectContaining({ and: expect.arrayContaining([scope]) }));
    expect(mocks.whereSelect).toHaveBeenCalledWith(expect.objectContaining({ and: expect.arrayContaining([scope]) }));
  });
});
