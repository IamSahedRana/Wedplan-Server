import { Router } from "express";

import * as bookingCtrl from "../controllers/booking.controller.js";
import { verifyJWT } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.get("/stats", verifyJWT, requireRole("customer"), bookingCtrl.customerStats);

export default router;
