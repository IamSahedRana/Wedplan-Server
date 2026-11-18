import { toSafeUser } from "../utils/user.js";

export async function getMe(req, res) {
  res.json({ user: toSafeUser(req.user) });
}
