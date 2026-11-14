import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAccessToken: vi.fn(),
  setCredentials: vi.fn(),
}));

vi.mock("google-auth-library", () => ({
  OAuth2Client: class {
    setCredentials = mocks.setCredentials;
    getAccessToken = mocks.getAccessToken;
  },
}));

import { createGmailApiTransport } from "../src/lib/gmailApiTransport";

beforeEach(() => {
  vi.stubEnv("GMAIL_API_SENDER", "sender@example.com");
  vi.stubEnv("GMAIL_API_CLIENT_ID", "client-id");
  vi.stubEnv("GMAIL_API_CLIENT_SECRET", "client-secret");
  vi.stubEnv("GMAIL_API_REFRESH_TOKEN", "refresh-token");
  vi.stubEnv("GMAIL_API_TEST_RECIPIENT_PROFILE_ID", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  vi.stubEnv("GMAIL_API_TEST_APPOINTMENT_ID", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  vi.stubEnv("GMAIL_API_TEST_NOT_BEFORE", "2026-11-14T20:00:00.000Z");
  mocks.getAccessToken.mockResolvedValue({ token: "access-token" });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("Gmail API test transport", () => {
  it("requires a valid recipient, appointment and precise UTC cutoff before starting", () => {
    vi.stubEnv("GMAIL_API_TEST_RECIPIENT_PROFILE_ID", "");
    expect(() => createGmailApiTransport()).toThrow("GMAIL_API_TEST_RECIPIENT_PROFILE_ID");
    vi.stubEnv("GMAIL_API_TEST_RECIPIENT_PROFILE_ID", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
    vi.stubEnv("GMAIL_API_TEST_APPOINTMENT_ID", "not-a-uuid");
    expect(() => createGmailApiTransport()).toThrow("GMAIL_API_TEST_APPOINTMENT_ID");
    vi.stubEnv("GMAIL_API_TEST_APPOINTMENT_ID", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
    vi.stubEnv("GMAIL_API_TEST_NOT_BEFORE", "2026-02-31T20:00:00.000Z");
    expect(() => createGmailApiTransport()).toThrow("GMAIL_API_TEST_NOT_BEFORE");
  });

  it("fails closed when the OAuth credentials are incomplete", () => {
    vi.stubEnv("GMAIL_API_REFRESH_TOKEN", "");
    expect(() => createGmailApiTransport()).toThrow("GMAIL_API_REFRESH_TOKEN");
  });

  it("sends a MIME message over HTTPS with the OAuth token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", fetchMock);
    const mailer = createGmailApiTransport();
    await mailer.transport.sendMail({ from: "sender@example.com", to: "qa@example.com", subject: "Cita QA", text: "Mensaje ficticio" });

    expect(mailer.testScope).toEqual({
      recipientProfileId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      appointmentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      notBefore: new Date("2026-11-14T20:00:00.000Z"),
    });
    expect(mocks.setCredentials).toHaveBeenCalledWith({ refresh_token: "refresh-token" });
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    expect(options.headers.Authorization).toBe("Bearer access-token");
    const mime = Buffer.from(JSON.parse(options.body).raw, "base64url").toString("utf8");
    expect(mime).toContain("sender@example.com");
    expect(mime).toContain("qa@example.com");
    expect(mime).toContain("Cita QA");
    expect(mime).toContain("Mensaje ficticio");
  });

  it("reports authorization and API errors without exposing credentials", async () => {
    const mailer = createGmailApiTransport();
    mocks.getAccessToken.mockRejectedValueOnce(new Error("refresh-token client-secret"));
    await expect(mailer.transport.sendMail({ from: "sender@example.com", to: "qa@example.com", subject: "QA", text: "QA" }))
      .rejects.toThrow("Gmail API authorization failed");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 429 }));
    await expect(mailer.transport.sendMail({ from: "sender@example.com", to: "qa@example.com", subject: "QA", text: "QA" }))
      .rejects.toThrow("Gmail API request failed with HTTP 429");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("access-token")));
    await expect(mailer.transport.sendMail({ from: "sender@example.com", to: "qa@example.com", subject: "QA", text: "QA" }))
      .rejects.toThrow("Gmail API request failed; check network connectivity.");
  });
});
