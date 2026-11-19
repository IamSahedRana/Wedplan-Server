import { Router } from "express";
import { z } from "zod";

import * as ctrl from "../controllers/admin.controller.js";
import { verifyJWT } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validate, validateObjectId } from "../middleware/validate.js";

const router = Router();

router.use(verifyJWT, requireRole("admin"));

const statusSchema = z
  .object({ status: z.enum(["approve", "reject", "activate", "deactivate"]) })
  .strict();

router.get("/stats", ctrl.adminStats);

router.get("/users", ctrl.listUsers);
router.get("/users/:id", validateObjectId(), ctrl.getUser);
router.patch("/users/:id/block", validateObjectId(), ctrl.blockUser);
router.patch("/users/:id/unblock", validateObjectId(), ctrl.unblockUser);

router.get("/services", ctrl.listServices);
router.patch(
  "/services/:id/status",
  validateObjectId(),
  validate(statusSchema),
  ctrl.setServiceStatus
);
router.delete("/services/:id", validateObjectId(), ctrl.deleteService);

router.get("/transactions", ctrl.listTransactions);

export default router;
