import { Router } from "express";
import { z } from "zod";

import * as ctrl from "../controllers/service.controller.js";
import { verifyJWT } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validate, validateObjectId } from "../middleware/validate.js";
import { CATEGORIES } from "../utils/constants.js";

const router = Router();

const createSchema = z
  .object({
    serviceName: z.string().min(3, "Service name must be at least 3 characters").max(100),
    category: z.enum(CATEGORIES),
    description: z.string().min(10, "Description must be at least 10 characters").max(2000),
    price: z.number().positive("Price must be positive").max(10_000_000),
    location: z.string().min(2, "Location is required").max(120),
    images: z.array(z.url("Each image must be a URL")).min(1, "At least one image is required").max(6),
  })
  .strict();

const updateSchema = z
  .object({
    serviceName: z.string().min(3).max(100).optional(),
    category: z.enum(CATEGORIES).optional(),
    description: z.string().min(10).max(2000).optional(),
    price: z.number().positive().max(10_000_000).optional(),
    location: z.string().min(2).max(120).optional(),
    images: z.array(z.url()).min(1).max(6).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Nothing to update" });

const availabilitySchema = z.object({ isActive: z.boolean() }).strict();

// Public
router.get("/", ctrl.listPublicServices);
router.get("/category-counts", ctrl.categoryCounts);

// Authenticated (any role)
router.get("/:id", verifyJWT, validateObjectId(), ctrl.getServiceById);

// Vendor
router.post("/", verifyJWT, requireRole("vendor"), validate(createSchema), ctrl.createService);
router.patch(
  "/:id",
  verifyJWT,
  requireRole("vendor"),
  validateObjectId(),
  validate(updateSchema),
  ctrl.updateService
);
router.patch(
  "/:id/availability",
  verifyJWT,
  requireRole("vendor"),
  validateObjectId(),
  validate(availabilitySchema),
  ctrl.setAvailability
);
router.delete("/:id", verifyJWT, requireRole("vendor"), validateObjectId(), ctrl.deleteService);

export default router;
