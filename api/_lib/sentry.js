import * as Sentry from "@sentry/node";

let _initialized = false;

function ensureInit() {
  if (_initialized) return;
  _initialized = true;

  Sentry.init({
    dsn: process.env.SENTRY_DSN_API,
    environment: process.env.VERCEL_ENV || "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

/**
 * withSentry — Wraps a Vercel serverless handler with Sentry error capture.
 * Catches unhandled exceptions, tags them with endpoint info, and flushes
 * before returning (mandatory: Vercel freezes the isolate on return).
 *
 * Usage: export default withSentry(handler);
 */
export function withSentry(handler) {
  return async (req, res) => {
    ensureInit();
    try {
      // Forward request ID from frontend for cross-stack correlation
      const requestId = req.headers["x-request-id"];
      if (requestId) {
        Sentry.setTag("request_id", requestId);
      }
      return await handler(req, res);
    } catch (err) {
      Sentry.captureException(err, {
        tags: {
          endpoint: req.url,
          action: req.query?.action,
          method: req.method,
        },
      });
      await Sentry.flush(2000); // serverless freezes on return — flush or lose the event
      if (!res.headersSent) {
        return res.status(500).json({ success: false, error: "Internal server error" });
      }
    }
  };
}

/**
 * captureSilentFailure — For swallowed errors (catch blocks that log and continue).
 * Call this instead of just console.warn/console.error.
 */
export function captureSilentFailure(error, context = {}) {
  ensureInit();
  if (error instanceof Error) {
    Sentry.captureException(error, { tags: context });
  } else {
    Sentry.captureMessage(String(error), {
      level: "warning",
      tags: context,
    });
  }
}

export { Sentry };
