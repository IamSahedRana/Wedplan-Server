import { Router } from "express";
import { z } from "zod";

import { getMe } from "../controllers/auth.controller.js";
import { updateProfile } from "../controllers/profile.controller.js";
import { verifyJWT } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const profileSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
    image: z.string().max(500).optional(),
    phone: z.string().max(30).optional(),
    address: z.string().max(200).optional(),
    bio: z.string().max(1000).optional(),
    businessName: z.string().max(100).optional(),
  })
  .strict();

router.get("/me", verifyJWT, getMe);
router.patch("/profile", verifyJWT, validate(profileSchema), updateProfile);

export default router;
