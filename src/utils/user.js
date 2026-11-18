const SAFE_FIELDS = [
  "_id",
  "name",
  "email",
  "image",
  "role",
  "isBlocked",
  "onboarded",
  "businessName",
  "phone",
  "address",
  "bio",
  "subscriptionPlan",
  "subscriptionExpiresAt",
  "createdAt",
];

/** Strips internal/sensitive fields from a user document. */
export function toSafeUser(user) {
  const safe = {};
  for (const field of SAFE_FIELDS) {
    if (user[field] !== undefined) safe[field] = user[field];
  }
  return safe;
}
