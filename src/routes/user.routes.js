import { Router } from "express";

import { getMe } from "../controllers/auth.controller.js";
import { verifyJWT } from "../middleware/auth.js";

const router = Router();

router.get("/me", verifyJWT, getMe);

export default router;
