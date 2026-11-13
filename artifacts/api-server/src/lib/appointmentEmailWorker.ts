import { and, eq, lte, lt, asc } from "drizzle-orm";
import nodemailer from "nodemailer";
import { appointmentNotificationsTable, db, userProfilesTable } from "@workspace/db";
import { logger } from "./logger";

const pollIntervalMs = 15_000;
const staleDeliveryMs = 5 * 60_000;
const maxAttempts = 5;
const retryDelaysMs = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000];
const batchSize = 10;

function createTransport() {
  const username = process.env.GMAIL_SMTP_USER?.trim();
  const appPassword = process.env.GMAIL_SMTP_APP_PASSWORD?.replace(/\s/g, "");
  if (!username && !appPassword) {
    logger.warn(
      "Gmail SMTP is not configured; appointment email notifications will remain queued.",
    );
    return null;
  }
  if (!username || !appPassword) {
    throw new Error(
      "Set both GMAIL_SMTP_USER and GMAIL_SMTP_APP_PASSWORD to enable appointment email.",
    );
  }

  const fromName = process.env.GMAIL_FROM_NAME?.trim() || "Monka";
  if (/[\r\n]/.test(fromName)) {
    throw new Error("GMAIL_FROM_NAME must not contain line breaks.");
  }

  return {
    username,
    fromName,
    transport: nodemailer.createTransport({
      service: "gmail",
      auth: { user: username, pass: appPassword },
    }),
  };
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 1000);
}

export function startAppointmentEmailWorker(): void {
  const mailer = createTransport();
  if (!mailer) {
    return;
  }

  let running = false;
  const processBatch = async (): Promise<void> => {
    if (running) {
      return;
    }
    running = true;
    try {
      const staleBefore = new Date(Date.now() - staleDeliveryMs);
      await db
        .update(appointmentNotificationsTable)
        .set({
          status: "pending",
          nextAttemptAt: new Date(),
          lastError: "Recovered an expired email delivery attempt.",
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(appointmentNotificationsTable.channel, "email"),
            eq(appointmentNotificationsTable.status, "sending"),
            lt(appointmentNotificationsTable.updatedAt, staleBefore),
          ),
        );

      const now = new Date();
      const pending = await db
        .select()
        .from(appointmentNotificationsTable)
        .where(
          and(
            eq(appointmentNotificationsTable.channel, "email"),
            eq(appointmentNotificationsTable.status, "pending"),
            lte(appointmentNotificationsTable.nextAttemptAt, now),
          ),
        )
        .orderBy(asc(appointmentNotificationsTable.createdAt))
        .limit(batchSize);

      for (const notification of pending) {
        const [claimed] = await db
          .update(appointmentNotificationsTable)
          .set({
            status: "sending",
            attempts: notification.attempts + 1,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(appointmentNotificationsTable.id, notification.id),
              eq(appointmentNotificationsTable.status, "pending"),
            ),
          )
          .returning();
        if (!claimed) {
          continue;
        }

        try {
          const [recipient] = await db
            .select({
              email: userProfilesTable.email,
              emailVerified: userProfilesTable.emailVerified,
            })
            .from(userProfilesTable)
            .where(eq(userProfilesTable.id, claimed.recipientProfileId))
            .limit(1);
          if (!recipient?.email || !recipient.emailVerified) {
            throw new Error("Recipient no longer has a verified email address.");
          }
          if (!claimed.subject || !claimed.message) {
            throw new Error("Email notification is missing its subject or message.");
          }

          await mailer.transport.sendMail({
            from: `"${mailer.fromName}" <${mailer.username}>`,
            to: recipient.email,
            subject: claimed.subject,
            text: claimed.message,
          });
          await db
            .update(appointmentNotificationsTable)
            .set({
              status: "sent",
              sentAt: new Date(),
              lastError: null,
              updatedAt: new Date(),
            })
            .where(eq(appointmentNotificationsTable.id, claimed.id));
        } catch (error) {
          const attempts = claimed.attempts;
          const failed = attempts >= maxAttempts;
          const message = errorMessage(error);
          await db
            .update(appointmentNotificationsTable)
            .set({
              status: failed ? "failed" : "pending",
              nextAttemptAt: new Date(
                Date.now() +
                  (retryDelaysMs[attempts - 1] ??
                    retryDelaysMs[retryDelaysMs.length - 1] ??
                    60 * 60_000),
              ),
              lastError: message,
              updatedAt: new Date(),
            })
            .where(eq(appointmentNotificationsTable.id, claimed.id));
          logger.error(
            { notificationId: claimed.id, attempts, err: error },
            failed
              ? "Appointment email delivery exhausted its retries"
              : "Appointment email delivery failed; retry scheduled",
          );
        }
      }
    } catch (error) {
      logger.error({ err: error }, "Appointment email worker batch failed");
    } finally {
      running = false;
    }
  };

  void processBatch();
  setInterval(() => {
    void processBatch();
  }, pollIntervalMs);
  logger.info("Appointment email worker started");
}
