import express, { type Express } from "express";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";

const app: Express = express();
const clerkAuthMode = process.env.CLERK_AUTH_MODE ?? "replit";
const usesExternalClerk = clerkAuthMode === "external";
if (clerkAuthMode !== "replit" && clerkAuthMode !== "external") {
  throw new Error('CLERK_AUTH_MODE must be either "replit" or "external".');
}

const allowedWebOrigins = (process.env.ALLOWED_WEB_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => {
    const parsed = new URL(origin);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("ALLOWED_WEB_ORIGINS must contain HTTP(S) origins.");
    }
    return parsed.origin;
  });

if (
  usesExternalClerk &&
  (!process.env.CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY ||
    allowedWebOrigins.length === 0)
) {
  throw new Error(
    "External Clerk mode requires CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, and ALLOWED_WEB_ORIGINS.",
  );
}

const requestLogger = pinoHttp({
  logger,
  serializers: {
    req(req) {
      return {
        id: req.id,
        method: req.method,
        url: req.url?.split("?")[0],
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
});

if (usesExternalClerk) {
  app.use(
    clerkMiddleware({
      publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
      secretKey: process.env.CLERK_SECRET_KEY,
      authorizedParties: allowedWebOrigins,
    }),
  );
  app.use(requestLogger);
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }
        try {
          callback(null, allowedWebOrigins.includes(new URL(origin).origin));
        } catch {
          callback(null, false);
        }
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
} else {
  app.use(requestLogger);
  app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (!usesExternalClerk) {
  app.use(
    clerkMiddleware((req) => ({
      publishableKey: publishableKeyFromHost(
        getClerkProxyHost(req) ?? "",
        process.env.CLERK_PUBLISHABLE_KEY,
      ),
    })),
  );
}

app.use("/api", router);

app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (req.log) {
      req.log.error({ err: error }, "Unhandled API error");
    } else {
      logger.error({ err: error }, "Unhandled API error");
    }
    if (
      error &&
      typeof error === "object" &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      res.status(413).json({ error: "La imagen supera el límite de 5 MB." });
      return;
    }
    res.status(500).json({ error: "Ocurrió un error inesperado." });
  },
);

export default app;
