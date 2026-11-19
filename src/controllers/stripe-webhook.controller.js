import { ObjectId } from "mongodb";

import { getDb } from "../config/db.js";
import { getStripe } from "../utils/stripe.js";
import { activatePro } from "../utils/subscription.js";

function refId(value) {
  return typeof value === "string" ? value : value?.id || null;
}

/** Claim an event atomically so concurrent retries cannot double-write. */
async function claimEvent(db, event) {
  try {
    await db.collection("webhook_events").insertOne({
      _id: event.id,
      type: event.type,
      createdAt: new Date(),
    });
    return true;
  } catch (err) {
    if (err.code === 11000) return false;
    throw err;
  }
}

function vendorIdFrom(object) {
  const value = object?.metadata?.userId || object?.client_reference_id;
  return value && ObjectId.isValid(value) ? new ObjectId(value) : null;
}

/** Verified webhook grants lifetime Pro; redirect status is never trusted. */
async function handleCheckoutCompleted(db, session) {
  if (session.mode && session.mode !== "payment") return;
  const vendorId = vendorIdFrom(session);
  if (!vendorId) return;

  const user = await db.collection("users").findOne({ _id: vendorId });
  if (!user) return;

  await activatePro(db, {
    userId: vendorId,
    sessionId: session.id,
    paymentIntentId: refId(session.payment_intent),
    amount: session.amount_total,
    currency: session.currency,
  });
}

/** Failed attempts are logged only; lifetime access is never revoked. */
async function handlePaymentFailed(db, object) {
  const vendorId = vendorIdFrom(object);
  const paymentIntentId = object.id;
  if (!vendorId) return;

  await db.collection("transactions").updateOne(
    { paymentIntentId },
    {
      $set: {
        userId: vendorId,
        plan: "PRO",
        status: "failed",
        paymentIntentId,
      },
      $setOnInsert: {
        amount: object.amount ?? 0,
        currency: (object.currency || "usd").toLowerCase(),
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
}

/** Raw-body, signature-verified Stripe webhook endpoint. */
export async function stripeWebhook(req, res) {
  const stripe = getStripe();
  const signature = req.headers["stripe-signature"];
  if (!signature)
    return res.status(400).json({ message: "Missing Stripe signature" });

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return res.status(400).json({ message: "Invalid Stripe signature" });
  }

  const db = await getDb();
  if (!(await claimEvent(db, event))) {
    return res.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(db, event.data.object);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentFailed(db, event.data.object);
        break;
      default:
        break;
    }
  } catch (err) {
    await db
      .collection("webhook_events")
      .deleteOne({ _id: event.id })
      .catch(() => {});
    console.error("Stripe webhook handler failed:", err.message);
    return res.status(500).json({ message: "Webhook handler failed" });
  }

  return res.json({ received: true });
}
