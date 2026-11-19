import { ObjectId } from "mongodb";

import { getDb } from "../config/db.js";
import { getStripe, subscriptionPeriodEnd } from "../utils/stripe.js";

const FREE_SERVICE_LIMIT = 3;
const DAY = 24 * 60 * 60 * 1000;

function idOf(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.id || null;
}

async function isProcessed(db, event) {
  const seen = await db.collection("webhook_events").findOne({ _id: event.id });
  return !!seen;
}

async function markProcessed(db, event) {
  try {
    await db.collection("webhook_events").insertOne({
      _id: event.id,
      type: event.type,
      createdAt: new Date(),
    });
  } catch (err) {
    if (err.code !== 11000) throw err;
  }
}

async function findVendor(db, { vendorId, customerId, subscriptionId }) {
  const or = [];
  if (vendorId && ObjectId.isValid(vendorId)) or.push({ _id: new ObjectId(vendorId) });
  if (customerId) or.push({ stripeCustomerId: customerId });
  if (subscriptionId) or.push({ stripeSubscriptionId: subscriptionId });
  if (or.length === 0) return null;
  return db.collection("users").findOne({ role: "vendor", $or: or });
}

async function resolveSubscription(stripe, ref) {
  if (!ref) return null;
  if (typeof ref === "object") return ref;
  return stripe.subscriptions.retrieve(ref);
}

/** Downgrade per AGENTS.md: free plan, keep 3 oldest active services. */
export async function downgradeVendor(db, vendorId) {
  await db.collection("users").updateOne(
    { _id: vendorId },
    {
      $set: { subscriptionPlan: "free", subscriptionExpiresAt: null },
      $unset: { stripeSubscriptionId: "" },
    }
  );

  const active = await db
    .collection("services")
    .find({ vendorId, isActive: true })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
  const excess = active.slice(FREE_SERVICE_LIMIT).map((s) => s._id);
  if (excess.length) {
    await db.collection("services").updateMany({ _id: { $in: excess } }, { $set: { isActive: false } });
  }
  return excess.length;
}

async function handleCheckoutCompleted(db, stripe, session) {
  if (session.mode && session.mode !== "subscription") return;
  const customerId = idOf(session.customer);
  const subscriptionId = idOf(session.subscription);
  const vendor = await findVendor(db, {
    vendorId: session.metadata?.vendorId,
    customerId,
    subscriptionId,
  });
  if (!vendor) return;

  const subscription = await resolveSubscription(stripe, session.subscription);
  const expiresAt =
    subscriptionPeriodEnd(subscription) || new Date(Date.now() + 30 * DAY);

  await db.collection("users").updateOne(
    { _id: vendor._id },
    {
      $set: {
        subscriptionPlan: "premium",
        subscriptionExpiresAt: expiresAt,
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      },
    }
  );

  await db.collection("transactions").updateOne(
    { stripeSessionId: session.id },
    {
      $set: {
        status: "paid",
        stripeCustomerId: customerId,
        stripeSubscriptionId: subscriptionId,
      },
      $setOnInsert: {
        vendorId: vendor._id,
        plan: "premium",
        amount: session.amount_total ?? 0,
        currency: (session.currency || "usd").toLowerCase(),
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

async function handleInvoicePaid(db, stripe, invoice) {
  const subscriptionId = idOf(invoice.subscription);
  const customerId = idOf(invoice.customer);
  const vendor = await findVendor(db, { customerId, subscriptionId });
  if (!vendor) return;

  const subscription = await resolveSubscription(stripe, invoice.subscription);
  const expiresAt = subscriptionPeriodEnd(subscription);
  const update = { subscriptionPlan: "premium" };
  if (expiresAt) update.subscriptionExpiresAt = expiresAt;
  await db.collection("users").updateOne({ _id: vendor._id }, { $set: update });
}

async function handleFailed(db, object) {
  const vendor = await findVendor(db, {
    customerId: idOf(object.customer),
    subscriptionId:
      idOf(object.subscription) || (object.object === "subscription" ? object.id : null),
  });
  if (!vendor) return;
  await downgradeVendor(db, vendor._id);
}

/** Verified, idempotent Stripe webhook endpoint. */
export async function stripeWebhook(req, res) {
  const stripe = getStripe();
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    return res.status(400).json({ message: "Missing Stripe signature" });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return res.status(400).json({ message: "Invalid Stripe signature" });
  }

  const db = await getDb();
  if (await isProcessed(db, event)) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(db, stripe, event.data.object);
        break;
      case "invoice.paid":
        await handleInvoicePaid(db, stripe, event.data.object);
        break;
      case "invoice.payment_failed":
      case "customer.subscription.deleted":
        await handleFailed(db, event.data.object);
        break;
      default:
        break;
    }
    await markProcessed(db, event);
  } catch (err) {
    console.error("Stripe webhook handler failed:", err.message);
    return res.status(500).json({ message: "Webhook handler failed" });
  }

  return res.json({ received: true });
}
