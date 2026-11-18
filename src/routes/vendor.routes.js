import { Router } from "express";

import * as bookingCtrl from "../controllers/booking.controller.js";
import { verifyJWT } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.get("/bookings", verifyJWT, requireRole("vendor"), bookingCtrl.vendorBookings);
router.get("/stats", verifyJWT, requireRole("vendor"), bookingCtrl.vendorStats);

export default router;
