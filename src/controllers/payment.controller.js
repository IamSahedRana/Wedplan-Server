import { getDb } from "../config/db.js";
import { getStripe } from "../utils/stripe.js";
import { activatePro } from "../utils/subscription.js";

function frontendUrl() {
  return (process.env.FRONTEND_URL || process.env.CLIENT_URL || "").replace(
    /\/+$/,
    "",
  );
}

function refId(value) {
  return typeof value === "string" ? value : value?.id || null;
}

function paging(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

/** One-time lifetime Pro checkout. Access is granted only by the verified webhook. */
export async function createCheckoutSession(req, res) {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId)
    return res.status(500).json({ message: "Stripe price is not configured" });

  const userId = req.user._id;
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: String(userId),
    customer_email: req.user.email,
    metadata: { userId: String(userId), plan: "PRO" },
    payment_intent_data: { metadata: { userId: String(userId), plan: "PRO" } },
    success_url: `${frontendUrl()}/dashboard/vendor/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl()}/dashboard/vendor/subscription/failed`,
  });

  const db = await getDb();
  await db.collection("transactions").insertOne({
    userId,
    plan: "PRO",
    amount: session.amount_total ?? 0,
    currency: (session.currency || "usd").toLowerCase(),
    status: "pending",
    stripeSessionId: session.id,
    paymentIntentId: refId(session.payment_intent),
    createdAt: new Date(),
  });

  return res.status(201).json({ url: session.url });
}

async function loadSession(req, sessionId) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const owner = session.metadata?.userId || session.client_reference_id;
  if (owner && owner !== String(req.user._id)) return { forbidden: true };

  const db = await getDb();
  const paymentIntentId = refId(session.payment_intent);
  const paid = session.payment_status === "paid";
  if (paid) {
    await activatePro(db, {
      userId: req.user._id,
      sessionId,
      paymentIntentId,
      amount: session.amount_total,
      currency: session.currency,
    });
  }

  const or = [{ stripeSessionId: sessionId }];
  if (paymentIntentId) or.push({ paymentIntentId });
  const transaction = await db.collection("transactions").findOne({
    userId: req.user._id,
    $or: or,
  });

  return {
    status:
      transaction?.status ||
      (paid ? "paid" : session.payment_status || "pending"),
    paymentStatus: session.payment_status || null,
    plan: session.metadata?.plan === "PRO" ? "PRO" : "FREE",
    subscriptionPlan: "PRO",
    subscriptionTimeline: "UNLIMITED",
    subscriptionId: paymentIntentId || session.id,
    sessionId: session.id,
    paymentIntentId,
    transactionId: transaction?._id || null,
    transaction,
  };
}

/** GET /api/payments/verify-session?session_id=... */
export async function verifySession(req, res) {
  res.set("Cache-Control", "no-store");
  const sessionId = String(req.query.session_id || "").trim();
  if (!sessionId)
    return res.status(400).json({ message: "Missing session_id" });
  const result = await loadSession(req, sessionId);
  if (result.forbidden)
    return res.status(403).json({ message: "Not your checkout session" });
  return res.json(result);
}

/** Legacy redirect verifier kept for /payment/success. */
export async function getSessionStatus(req, res) {
  res.set("Cache-Control", "no-store");
  const result = await loadSession(req, req.params.id);
  if (result.forbidden)
    return res.status(403).json({ message: "Not your checkout session" });
  return res.json(result);
}

/** Vendor's own payment history. */
export async function vendorTransactions(req, res) {
  const db = await getDb();
  const { page, limit, skip } = paging(req.query);
  const match = { $or: [{ userId: req.user._id }, { vendorId: req.user._id }] };

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
