import Stripe from "stripe";

let client;

/** Lazily constructed so missing config only affects payment routes. */
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    const err = new Error("Stripe is not configured");
    err.status = 500;
    throw err;
  }
  if (!client) client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

/** Stripe 2026-02-25.clover keeps periodend on subscription items, not on the subscription. */
export function subscriptionPeriodEnd(subscription) {
  const item = subscription?.items?.data?.[0];
  const seconds = item?.current_period_end ?? subscription?.current_period_end;
  return seconds ? new Date(seconds * 1000) : null;
}
