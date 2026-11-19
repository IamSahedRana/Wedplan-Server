import { ObjectId } from "mongodb";

import { getDb } from "../config/db.js";
import { getEffectivePlan } from "../utils/plan.js";

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const VENDOR_PROJECT = {
  name: 1,
  image: 1,
  businessName: 1,
  subscriptionPlan: 1,
  subscriptionExpiresAt: 1,
  isBlocked: 1,
};

/** Public listing: approved + active + vendor not blocked, with filters, sort, pagination. */
export async function listPublicServices(req, res) {
  const db = await getDb();
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 12));
  const sortMap = {
    price_asc: { "price": 1 },
    price_desc: { "price": -1 },
    newest: { "createdAt": -1 },
  };
  const sort = sortMap[req.query.sort] || sortMap.newest;

  const match = { status: "approved", isActive: true };

  if (req.query.q) {
    const rx = escapeRegex(req.query.q);
    match.$or = ["serviceName", "description", "category", "location"].map((field) => ({
      [field]: { $regex: rx, $options: "i" },
    }));
  }
  if (req.query.category) match.category = req.query.category;
  if (req.query.location) match.location = { $regex: escapeRegex(req.query.location), $options: "i" };

  const minPrice = Number(req.query.minPrice);
  const maxPrice = Number(req.query.maxPrice);
  if (req.query.minPrice !== undefined && req.query.minPrice !== "" && !Number.isFinite(minPrice)) {
    return res.status(400).json({ message: "minPrice must be a number" });
  }
  if (req.query.maxPrice !== undefined && req.query.maxPrice !== "" && !Number.isFinite(maxPrice)) {
    return res.status(400).json({ message: "maxPrice must be a number" });
  }
  if (Number.isFinite(minPrice) || Number.isFinite(maxPrice)) {
    match.price = {
      ...(Number.isFinite(minPrice) && { $gte: minPrice }),
      ...(Number.isFinite(maxPrice) && { $lte: maxPrice }),
    };
  }

  const now = new Date();
  const [facet] = await db
    .collection("services")
    .aggregate([
      { $match: match },
      {
        $lookup: {
          from: "users",
          localField: "vendorId",
          foreignField: "_id",
          pipeline: [{ $project: VENDOR_PROJECT }],
          as: "vendor",
        },
      },
      { $unwind: "$vendor" },
      { $match: { "vendor.isBlocked": { $ne: true } } },
      {
        $addFields: {
          "vendor.plan": {
            $cond: [
              {
                $and: [
                  { $eq: ["$vendor.subscriptionPlan", "premium"] },
                  { $gt: ["$vendor.subscriptionExpiresAt", now] },
                ],
              },
              "premium",
              "free",
            ],
          },
        },
      },
      {
        $facet: {
          items: [{ $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ])
    .toArray();

  const total = facet?.total?.[0]?.count || 0;
  const items = (facet?.items || []).map((s) => {
    delete s.vendor.isBlocked;
    delete s.vendor.subscriptionPlan;
    delete s.vendor.subscriptionExpiresAt;
    return s;
  });

  return res.json({ items, total, page, pages: Math.ceil(total / limit) || 1 });
}

/** Counts of approved+active services (vendor not blocked) per category. */
export async function categoryCounts(_req, res) {
  const db = await getDb();
  const counts = await db
    .collection("services")
    .aggregate([
      { $match: { status: "approved", isActive: true } },
      {
        $lookup: {
          from: "users",
          localField: "vendorId",
          foreignField: "_id",
          pipeline: [{ $project: { isBlocked: 1 } }],
          as: "vendor",
        },
      },
      { $unwind: "$vendor" },
      { $match: { "vendor.isBlocked": { $ne: true } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $project: { _id: 0, category: "$_id", count: 1 } },
      { $sort: { count: -1 } },
    ])
    .toArray();

  return res.json({ items: counts });
}

/** Service detail: only approved+active services of unblocked vendors are public; owner/admin may view any. */
export async function getServiceById(req, res) {
  const db = await getDb();
  const id = new ObjectId(req.params.id);
  const service = await db.collection("services").findOne({ _id: id });
  if (!service) return res.status(404).json({ message: "Service not found" });

  const vendor = await db.collection("users").findOne(
    { _id: service.vendorId },
    { projection: { name: 1, image: 1, businessName: 1, isBlocked: 1, subscriptionPlan: 1, subscriptionExpiresAt: 1 } }
  );

  const isOwner = service.vendorId.equals(req.user._id);
  const isAdmin = req.user.role === "admin";
  if (!isOwner && !isAdmin) {
    if (service.status !== "approved" || service.isActive !== true || vendor?.isBlocked) {
      return res.status(404).json({ message: "Service not found" });
    }
  }

  if (vendor) {
    vendor.plan = getEffectivePlan(vendor);
    delete vendor.isBlocked;
    delete vendor.subscriptionPlan;
    delete vendor.subscriptionExpiresAt;
  }

  return res.json({ service: { ...service, vendor } });
}

const FREE_SERVICE_LIMIT = 3;

/** Vendor creates a service — starts pending; free vendors limited to 3 active services. */
export async function createService(req, res) {
  const db = await getDb();
  const vendorId = req.user._id;

  if (getEffectivePlan(req.user) === "free") {
    const activeCount = await db.collection("services").countDocuments({ vendorId, isActive: true });
    if (activeCount >= FREE_SERVICE_LIMIT) {
      return res.status(403).json({
        message: "Free plan allows a maximum of 3 active services. Upgrade to Premium for unlimited services.",
      });
    }
  }

  const now = new Date();
  const doc = {
    vendorId,
    serviceName: req.body.serviceName,
    category: req.body.category,
    description: req.body.description,
    price: req.body.price,
    location: req.body.location,
    images: req.body.images,
    status: "pending",
    isActive: true,
    createdAt: now,
  };
  const result = await db.collection("services").insertOne(doc);

  return res.status(201).json({ message: "Service created", service: { _id: result.insertedId, ...doc } });
}

/** Vendor lists all their own services (any status). */
export async function listMyServices(req, res) {
  const db = await getDb();
  const items = await db
    .collection("services")
    .find({ vendorId: req.user._id })
    .sort({ createdAt: -1 })
    .toArray();

  return res.json({ items, plan: getEffectivePlan(req.user) });
}

/** Vendor updates own service — whitelist fields only, status/isActive immutable here. */
export async function updateService(req, res) {
  const db = await getDb();
  const id = new ObjectId(req.params.id);
  const service = await db.collection("services").findOne({ _id: id });
  if (!service) return res.status(404).json({ message: "Service not found" });
  if (!service.vendorId.equals(req.user._id)) {
    return res.status(404).json({ message: "Service not found" });
  }

  const update = {};
  for (const field of ["serviceName", "category", "description", "price", "location", "images"]) {
    if (req.body[field] !== undefined) update[field] = req.body[field];
  }
  if (Object.keys(update).length === 0) {
    return res.status(400).json({ message: "Nothing to update" });
  }

  await db.collection("services").updateOne({ _id: id }, { $set: update });
  const updated = await db.collection("services").findOne({ _id: id });
  return res.json({ message: "Service updated", service: updated });
}

/** Vendor toggles availability of own service — re-activation enforces free limit. */
export async function setAvailability(req, res) {
  const db = await getDb();
  const id = new ObjectId(req.params.id);
  const service = await db.collection("services").findOne({ _id: id });
  if (!service) return res.status(404).json({ message: "Service not found" });
  if (!service.vendorId.equals(req.user._id)) {
    return res.status(404).json({ message: "Service not found" });
  }

  const { isActive } = req.body;
  if (isActive && getEffectivePlan(req.user) === "free") {
    const activeCount = await db.collection("services").countDocuments({
      vendorId: req.user._id,
      isActive: true,
      _id: { $ne: id },
    });
    if (activeCount >= FREE_SERVICE_LIMIT) {
      return res.status(403).json({
        message: "Free plan allows a maximum of 3 active services. Upgrade to Premium for unlimited services.",
      });
    }
  }

  await db.collection("services").updateOne({ _id: id }, { $set: { isActive } });
  return res.json({ message: isActive ? "Service activated" : "Service deactivated" });
}

/** Vendor deletes own service. */
export async function deleteService(req, res) {
  const db = await getDb();
  const id = new ObjectId(req.params.id);
  const service = await db.collection("services").findOne({ _id: id });
  if (!service) return res.status(404).json({ message: "Service not found" });
  if (!service.vendorId.equals(req.user._id)) {
    return res.status(404).json({ message: "Service not found" });
  }

  await db.collection("services").deleteOne({ _id: id });
  return res.json({ message: "Service deleted" });
}
