/** Idempotent lifetime-Pro grant used by both the Stripe webhook and session verification. */
export async function activatePro(
  db,
  { userId, sessionId, paymentIntentId, amount, currency },
) {
  if (!userId || !sessionId) return null;

  const subscriptionId = paymentIntentId || sessionId;
  await db.collection("users").updateOne(
    { _id: userId },
    {
      $set: {
        subscriptionPlan: "PRO",
        subscriptionId,
        subscriptionTimeline: "UNLIMITED",
        subscriptionExpiresAt: null,
      },
    },
  );

  await db.collection("transactions").updateOne(
    { stripeSessionId: sessionId },
    {
      $set: {
        userId,
        plan: "PRO",
        status: "paid",
        amount: amount ?? 0,
        currency: (currency || "usd").toLowerCase(),
        stripeSessionId: sessionId,
        paymentIntentId: paymentIntentId || null,
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );

  return subscriptionId;
}
