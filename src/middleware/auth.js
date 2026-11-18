import { createRemoteJWKSet, jwtVerify } from "jose";
import { ObjectId } from "mongodb";

import { getDb } from "../config/db.js";

let jwks;

function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${process.env.CLIENT_URL}/api/auth/jwks`));
  }
  return jwks;
}

export async function verifyJWT(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: "Authentication required" });

    const { payload } = await jwtVerify(token, getJwks());
    const user = await getDb().collection("users").findOne({ _id: new ObjectId(payload.sub) });
    if (!user) return res.status(401).json({ message: "Authentication required" });
    if (user.isBlocked) return res.status(403).json({ message: "Account is blocked" });

    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
