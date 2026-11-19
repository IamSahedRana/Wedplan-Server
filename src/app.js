import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { errorHandler, notFound } from "./middleware/error.js";
import adminRoutes from "./routes/admin.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import customerRoutes from "./routes/customer.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import userRoutes from "./routes/user.routes.js";
import vendorRoutes from "./routes/vendor.routes.js";

const app = express();

app.set("trust proxy", 1);
app.disable("x-powered-by");

// ---------------------------------------------------------------------------
// Stripe webhook mount slot — MUST stay before express.json() so the raw
// request body is available for signature verification.
//
// app.use(
//   "/api/webhooks/stripe",
//   express.raw({ type: "application/json" }),
//   stripeWebhookRouter
// );
// ---------------------------------------------------------------------------

app.use(helmet());
app.use(morgan(process.env.NODE_ENV === "production" ? "tiny" : "dev"));
app.use(
  cors({
    origin(origin, callback) {
      const allowed = process.env.CLIENT_URL;
      if (!origin || !allowed || origin === allowed) return callback(null, true);
      return callback(null, false);
    },
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ---------------------------------------------------------------------------
// Routes mount slot
//
// app.use("/api/...", someRouter);
// ---------------------------------------------------------------------------

app.use("/api/services", serviceRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/customer", customerRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", userRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
