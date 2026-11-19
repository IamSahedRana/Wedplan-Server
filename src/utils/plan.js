/**
 * Pro is a one-time lifetime purchase: "PRO" plan + "UNLIMITED" timeline.
 * Legacy paid "premium" users with a future expiry keep access.
 */
export function getEffectivePlan(user) {
  const lifetime =
    user?.subscriptionPlan === "PRO" && user?.subscriptionTimeline === "UNLIMITED";
  const legacy =
    user?.subscriptionPlan === "premium" &&
    user?.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt).getTime() > Date.now();
  return lifetime || legacy ? "premium" : "free";
}
