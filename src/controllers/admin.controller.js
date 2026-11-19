import { ObjectId } from "mongodb";

import { getDb } from "../config/db.js";
import { CATEGORIES } from "../utils/constants.js";
import { getEffectivePlan } from "../utils/plan.js";
import { toSafeUser } from "../utils/user.js";

const FREE_SERVICE_LIMIT = 3;
const USER_ROLES = ["vendor", "customer", "admin"];
const SERVICE_STATUSES = ["pending", "approved", "rejected"];
const TRANSACTION_STATUSES = ["paid", "pending", "failed"];

const VENDOR_PROJECT = {
  name: 1,
  email: 1,
  image: 1,
  businessName: 1,
};

function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function paging(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function pageInfo(total, page, limit) {
  return { total, page, pages: Math.ceil(total / limit) || 1 };
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function endOfDayUTC(value) {
  const date = parseDate(value);
  if (date === undefined || date === null) return date;
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
}

function joinVendorAsObject() {
  return [
    {
      $lookup: {
        from: "users",
        localField: "vendorId",
        foreignField: "_id",
        pipeline: [{ $project: VENDOR_PROJECT }],
        as: "vendor",
      },
    },
    { $addFields: { vendor: { $arrayElemAt: ["$vendor", 0] } } },
  ];
}

/** Platform-wide counts for the admin dashboard. */
export async function adminStats(_req, res) {
  const db = await getDb();
  const [users, vendors, customers, services, pendingServices, transactions] = await Promise.all([
    db.collection("users").countDocuments({}),
    db.collection("users").countDocuments({ role: "vendor" }),
    db.collection("users").countDocuments({ role: "customer" }),
    db.collection("services").countDocuments({}),
    db.collection("services").countDocuments({ status: "pending" }),
    db.collection("transactions").countDocuments({}),
  ]);

  return res.json({
    totalUsers: users,
    vendors,
    customers,
    services,
    pendingServices,
    transactions,
  });
}

/** Users with name/email search, role filter and pagination. */
export async function listUsers(req, res) {
  const role = req.query.role;
  if (role && !USER_ROLES.includes(role)) {
    return res.status(400).json({ message: "Invalid role filter" });
  }

  const db = await getDb();
  const { page, limit, skip } = paging(req.query);
  const match = {};
  if (req.query.q) {
    const rx = escapeRegex(req.query.q);
    match.$or = [{ name: { $regex: rx, $options: "i" } }, { email: { $regex: rx, $options: "i" } }];
  }
  if (role) match.role = role;

  const [docs, total] = await Promise.all([
    db
      .collection("users")
      .find(match)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray(),
    db.collection("users").countDocuments(match),
  ]);

  return res.json({ items: docs.map(toSafeUser), ...pageInfo(total, page, limit) });
}

/** Single user detail for admin moderation. */
export async function getUser(req, res) {
  const db = await getDb();
  const user = await db.collection("users").findOne({ _id: new ObjectId(req.params.id) });
  if (!user) return res.status(404).json({ message: "User not found" });
  return res.json({ user: toSafeUser(user) });
}

async function setBlocked(req, res, isBlocked) {
  const db = await getDb();
  const id = new ObjectId(req.params.id);
  const target = await db.collection("users").findOne({ _id: id });
  if (!target) return res.status(404).json({ message: "User not found" });

  if (isBlocked && (target.role === "admin" || target._id.equals(req.user._id))) {
    return res.status(403).json({ message: "You cannot block this account" });
  }

  await db.collection("users").updateOne({ _id: id }, { $set: { isBlocked } });
  const updated = await db.collection("users").findOne({ _id: id });
  return res.json({
    message: isBlocked ? "User blocked" : "User unblocked",
    user: toSafeUser(updated),
  });
}

export function blockUser(req, res) {
  return setBlocked(req, res, true);
}

export function unblockUser(req, res) {
  return setBlocked(req, res, false);
}

/** All services with search/status/category filters, price sort and pagination. */
export async function listServices(req, res) {
  const status = req.query.status;
  const category = req.query.category;
  if (status && !SERVICE_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status filter" });
  }
  if (category && !CATEGORIES.includes(category)) {
    return res.status(400).json({ message: "Invalid category filter" });
  }

  const db = await getDb();
  const { page, limit, skip } = paging(req.query);
  const match = {};
  if (req.query.q) {
    const rx = escapeRegex(req.query.q);
    match.$or = [
      { serviceName: { $regex: rx, $options: "i" } },
      { description: { $regex: rx, $options: "i" } },
      { location: { $regex: rx, $options: "i" } },
    ];
  }
  if (status) match.status = status;
  if (category) match.category = category;

  const sortMap = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    newest: { createdAt: -1 },
  };
  const sort = sortMap[req.query.sort] || sortMap.newest;

  const [facet] = await db
    .collection("services")
    .aggregate([
      { $match: match },
      ...joinVendorAsObject(),
      {
        $facet: {
          items: [{ $sort: sort }, { $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ])
    .toArray();

  return res.json({
    items: facet?.items || [],
    ...pageInfo(facet?.total?.[0]?.count || 0, page, limit),
  });
}

const STATUS_ACTIONS = {
  approve: { status: "approved" },
  reject: { status: "rejected" },
  activate: { isActive: true },
  deactivate: { isActive: false },
};

/** Admin moderation: approve/reject or activate/deactivate a service. */
export async function setServiceStatus(req, res) {
  const db = await getDb();
  const id = new ObjectId(req.params.id);
  const service = await db.collection("services").findOne({ _id: id });
  if (!service) return res.status(404).json({ message: "Service not found" });

  const { status } = req.body;
  const update = STATUS_ACTIONS[status];
  if (!update) return res.status(400).json({ message: "Invalid status action" });

  if (status === "activate" && !service.isActive) {
    const vendor = await db.collection("users").findOne({ _id: service.vendorId });
    if (vendor && getEffectivePlan(vendor) === "free") {
      const activeCount = await db.collection("services").countDocuments({
        vendorId: service.vendorId,
        isActive: true,
        _id: { $ne: id },
      });
      if (activeCount >= FREE_SERVICE_LIMIT) {
        return res.status(403).json({
          message:
            "Free plan allows a maximum of 3 active services. Upgrade to Premium for unlimited services.",
        });
      }
    }
  }

  await db.collection("services").updateOne({ _id: id }, { $set: update });
  const updated = await db.collection("services").findOne({ _id: id });
  return res.json({ message: `Service ${status}d`, service: updated });
}

/** Admin deletes any service listing. */
export async function deleteService(req, res) {
  const db = await getDb();
  const id = new ObjectId(req.params.id);
  const result = await db.collection("services").deleteOne({ _id: id });
  if (result.deletedCount === 0) return res.status(404).json({ message: "Service not found" });
  return res.json({ message: "Service deleted" });
}

/** Read-only transaction ledger with status/date filters and vendor joined. */
export async function listTransactions(req, res) {
  const status = req.query.status;
  if (status && !TRANSACTION_STATUSES.includes(status)) {
    return res.status(400).json({ message: "Invalid status filter" });
  }

  const from = parseDate(req.query.from);
  const to = endOfDayUTC(req.query.to);
  if (from === undefined || to === undefined) {
    return res.status(400).json({ message: "Invalid date filter" });
  }

  const db = await getDb();
  const { page, limit, skip } = paging(req.query);
  const match = {};
  if (status) match.status = status;
  if (from || to) {
    match.createdAt = {
      ...(from && { $gte: from }),
      ...(to && { $lte: to }),
    };
  }

  const [facet] = await db
    .collection("transactions")
    .aggregate([
      { $match: match },
      ...joinVendorAsObject(),
      {
        $facet: {
          items: [{ $sort: { createdAt: -1 } }, { $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ])
    .toArray();

  return res.json({
    items: facet?.items || [],
    ...pageInfo(facet?.total?.[0]?.count || 0, page, limit),
  });
}
