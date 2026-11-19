import { getDb } from "../config/db.js";
import { getStripe } from "../utils/stripe.js";

const DEFAULT_PREMIUM_CENTS = 999;

function paging(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/** Vendor starts a Premium subscription; a pending transaction records the attempt. */
export async function createCheckoutSession(req, res) {
  const stripe = getStripe();
  const clientUrl = (process.env.CLIENT_URL || "").replace(/\/+$/, "");
  const vendorId = req.user._id;
  const priceId = process.env.STRIPE_PRICE_ID;
  const unitAmount = Number(process.env.STRIPE_PREMIUM_PRICE_CENTS) || DEFAULT_PREMIUM_CENTS;

  const lineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          recurring: { interval: "month" },
          product_data: { name: "WedPlan Premium" },
        },
        quantity: 1,
      };

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [lineItem],
    customer_email: req.user.email,
    metadata: { vendorId: String(vendorId) },
    subscription_data: { metadata: { vendorId: String(vendorId) } },
    success_url: `${clientUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientUrl}/payment/cancel`,
  });

  const db = await getDb();
  await db.collection("transactions").insertOne({
    vendorId,
    plan: "premium",
    amount: session.amount_total ?? unitAmount / 100,
    currency: (session.currency || "usd").toLowerCase(),
    stripeSessionId: session.id,
    status: "pending",
    createdAt: new Date(),
  });

  return res.status(201).json({ url: session.url, sessionId: session.id });
}

/** Vendor cancels at period end — access stays active until expiry. */
export async function cancelSubscription(req, res) {
  const stripe = getStripe();
  const subscriptionId = req.user.stripeSubscriptionId;
  if (!subscriptionId) {
    return res.status(400).json({ message: "No active subscription found" });
  }

  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
  return res.json({
    message: "Subscription will be cancelled at the end of the billing period",
    cancelAtPeriodEnd: !!subscription.cancel_at_period_end,
  });
}

/** Vendor checks the outcome of their own checkout session. */
export async function getSessionStatus(req, res) {
  const db = await getDb();
  const transaction = await db.collection("transactions").findOne({
    stripeSessionId: req.params.id,
    vendorId: req.user._id,
  });
  if (!transaction) return res.status(404).json({ message: "Transaction not found" });
  return res.json({ status: transaction.status, transaction });
}

/** Vendor's own payment/subscription history. */
export async function vendorTransactions(req, res) {
  const db = await getDb();
  const { page, limit, skip } = paging(req.query);
  const match = { vendorId: req.user._id };

  const [items, total] = await Promise.all([
    db
      .collection("transactions")
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection("transactions").countDocuments(match),
  ]);

  return res.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit) || 1,
  });
}
