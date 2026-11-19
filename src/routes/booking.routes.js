import { Router } from "express";
import { z } from "zod";

import * as ctrl from "../controllers/booking.controller.js";
import { verifyJWT } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validate, validateObjectId } from "../middleware/validate.js";

const router = Router();

const createSchema = z
  .object({
    serviceId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid service id"),
    eventDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Event date must be in YYYY-MM-DD format"),
    eventLocation: z.string().min(2, "Event location is required").max(120),
    message: z.string().max(500).optional(),
  })
  .strict();

const statusSchema = z
  .object({ status: z.enum(["accepted", "rejected"]) })
  .strict();

// Customer
router.post(
  "/",
  verifyJWT,
  requireRole("customer"),
  validate(createSchema),
  ctrl.createBooking,
);
router.get("/my", verifyJWT, requireRole("customer"), ctrl.myBookings);
router.patch(
  "/:id/cancel",
  verifyJWT,
  requireRole("customer"),
  validateObjectId(),
  ctrl.cancelBooking,
);

// Vendor
router.patch(
  "/:id/status",
  verifyJWT,
  requireRole("vendor"),
  validateObjectId(),
  validate(statusSchema),
  ctrl.updateStatus,
);

export default router;
