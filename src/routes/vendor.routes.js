import { Router } from "express";

import * as bookingCtrl from "../controllers/booking.controller.js";
import * as paymentCtrl from "../controllers/payment.controller.js";
import * as serviceCtrl from "../controllers/service.controller.js";
import { verifyJWT } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";

const router = Router();

router.get("/bookings", verifyJWT, requireRole("vendor"), bookingCtrl.vendorBookings);
router.get("/services", verifyJWT, requireRole("vendor"), serviceCtrl.listMyServices);
router.get("/stats", verifyJWT, requireRole("vendor"), bookingCtrl.vendorStats);
router.get("/transactions", verifyJWT, requireRole("vendor"), paymentCtrl.vendorTransactions);

export default router;
