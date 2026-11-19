import { getDb } from "../config/db.js";
import { toSafeUser } from "../utils/user.js";

const PROFILE_FIELDS = ["name", "image", "phone", "address", "bio", "businessName"];

/** Any authenticated user may update their own whitelist of profile fields. */
export async function updateProfile(req, res) {
  const update = {};
  for (const field of PROFILE_FIELDS) {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  }
  if (Object.keys(update).length === 0) {
    return res.status(400).json({ message: "Nothing to update" });
  }

  const db = await getDb();
  await db.collection("users").updateOne({ _id: req.user._id }, { $set: update });
  const user = await db.collection("users").findOne({ _id: req.user._id });
  return res.json({ message: "Profile updated", user: toSafeUser(user) });
}
