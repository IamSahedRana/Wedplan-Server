/**
 * Premium only while subscriptionPlan is "premium" AND the subscription
 * hasn't expired. Use everywhere (limit checks, badges, stats).
 */
export function getEffectivePlan(user) {
  const isPremium =
    user?.subscriptionPlan === "premium" &&
    user?.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt).getTime() > Date.now();
  return isPremium ? "premium" : "free";
}
