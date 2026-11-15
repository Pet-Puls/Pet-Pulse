import { OAuth2Client } from "google-auth-library";
import nodemailer from "nodemailer";

type GmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required for the Gmail API test transport.`);
  }
  return value;
}

function oauthFailure(error: unknown): string {
  const prefix = "Gmail API authorization failed";
  if (typeof error !== "object" || error === null) {
    return `${prefix}; check the OAuth configuration.`;
  }

  const response = "response" in error ? error.response : undefined;
  const data = typeof response === "object" && response !== null && "data" in response
    ? response.data
    : undefined;
  const code = typeof data === "object" && data !== null && "error" in data
    ? data.error
    : undefined;
  if (
    code === "invalid_client" ||
    code === "invalid_grant" ||
    code === "invalid_request" ||
    code === "invalid_scope" ||
    code === "unauthorized_client" ||
    code === "access_denied"
  ) {
    return `${prefix}: ${code}.`;
  }

  const status = typeof response === "object" && response !== null && "status" in response
    ? response.status
    : undefined;
  if (typeof status === "number" && Number.isInteger(status) && status >= 400 && status <= 599) {
    return `${prefix}: HTTP ${status}.`;
  }
  return `${prefix}; check the OAuth configuration or network connectivity.`;
}

export function createGmailApiTransport() {
  const username = requiredEnv("GMAIL_API_SENDER");
  const clientId = requiredEnv("GMAIL_API_CLIENT_ID");
  const clientSecret = requiredEnv("GMAIL_API_CLIENT_SECRET");
  const refreshToken = requiredEnv("GMAIL_API_REFRESH_TOKEN");
  const recipientProfileId = requiredEnv("GMAIL_API_TEST_RECIPIENT_PROFILE_ID");
  const appointmentId = requiredEnv("GMAIL_API_TEST_APPOINTMENT_ID");
  const notBeforeValue = requiredEnv("GMAIL_API_TEST_NOT_BEFORE");
  const notBefore = new Date(notBeforeValue);
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidPattern.test(recipientProfileId) || !uuidPattern.test(appointmentId)) {
    throw new Error("GMAIL_API_TEST_RECIPIENT_PROFILE_ID and GMAIL_API_TEST_APPOINTMENT_ID must be UUIDs.");
  }
  if (!Number.isFinite(notBefore.getTime()) || notBefore.toISOString() !== notBeforeValue) {
    throw new Error("GMAIL_API_TEST_NOT_BEFORE must be an ISO UTC timestamp with milliseconds.");
  }
  const fromName = process.env.GMAIL_FROM_NAME?.trim() || "Monka";
  if (/[\r\n]/.test(fromName)) {
    throw new Error("GMAIL_FROM_NAME must not contain line breaks.");
  }

  const oauth = new OAuth2Client(clientId, clientSecret);
  oauth.setCredentials({ refresh_token: refreshToken });
  const composer = nodemailer.createTransport({ streamTransport: true, buffer: true });

  return {
    username,
    fromName,
    testScope: { recipientProfileId, appointmentId, notBefore },
    transport: {
      async sendMail(message: GmailMessage): Promise<void> {
        let token: string | null | undefined;
        try {
          token = (await oauth.getAccessToken()).token;
        } catch (error) {
          throw new Error(oauthFailure(error));
        }
        if (!token) {
          throw new Error("Gmail API authorization did not return an access token.");
        }

        let raw: string;
        try {
          const composed = await composer.sendMail({
            from: { name: fromName, address: username },
            to: message.to,
            subject: message.subject,
            text: message.text,
          });
          if (!Buffer.isBuffer(composed.message)) {
            throw new Error("Message was not buffered.");
          }
          raw = composed.message.toString("base64url");
        } catch {
          throw new Error("Could not compose the Gmail API message.");
        }

        let response: Response;
        try {
          response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ raw }),
            signal: AbortSignal.timeout(30_000),
          });
        } catch {
          throw new Error("Gmail API request failed; check network connectivity.");
        }
        if (!response.ok) {
          throw new Error(`Gmail API request failed with HTTP ${response.status}.`);
        }
      },
    },
  };
}
