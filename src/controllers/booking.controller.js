import { ObjectId } from "mongodb";

import { getDb } from "../config/db.js";
import { getEffectivePlan } from "../utils/plan.js";

/** Customer creates a booking request for an approved+active service. */
export async function createBooking(req, res) {
  const db = getDb();
  const serviceId = new ObjectId(req.body.serviceId);

  const service = await db.collection("services").findOne({ _id: serviceId });
  if (!service) return res.status(404).json({ message: "Service not found" });
  if (service.status !== "approved" || !service.isActive) {
    return res.status(400).json({ message: "Service is not available for booking" });
  }
  if (service.vendorId.equals(req.user._id)) {
    return res.status(400).json({ message: "You cannot book your own service" });
  }

  const raw = new Date(req.body.eventDate);
  if (Number.isNaN(raw.getTime())) {
    return res.status(400).json({ message: "Invalid event date" });
  }
  const eventDate = new Date(
    Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate())
  );
  if (eventDate.getTime() <= Date.now()) {
    return res.status(400).json({ message: "Event date must be in the future" });
  }

  const duplicate = await db.collection("bookings").findOne({
    customerId: req.user._id,
    serviceId,
    eventDate,
    status: { $in: ["pending", "accepted"] },
  });
  if (duplicate) {
    return res
      .status(409)
      .json({ message: "You already have a booking request for this service on this date" });
  }

  const doc = {
    serviceId,
    vendorId: service.vendorId,
    customerId: req.user._id,
    eventDate,
    eventLocation: req.body.eventLocation,
    message: req.body.message || "",
    status: "pending",
    createdAt: new Date(),
  };
  const result = await db.collection("bookings").insertOne(doc);

  return res.status(201).json({ message: "Booking request sent", booking: { _id: result.insertedId, ...doc } });
}

/** Customer lists their own bookings with service + vendor info. */
export async function myBookings(req, res) {
  const db = getDb();
  const items = await db
    .collection("bookings")
    .aggregate([
      { $match: { customerId: req.user._id } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "services",
          localField: "serviceId",
          foreignField: "_id",
          pipeline: [
            { $project: { serviceName: 1, category: 1, price: 1, images: 1, location: 1 } },
          ],
          as: "service",
        },
      },
      { $unwind: "$service" },
      {
        $lookup: {
          from: "users",
          localField: "vendorId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1, image: 1, businessName: 1 } }],
          as: "vendor",
        },
      },
      { $unwind: "$vendor" },
    ])
    .toArray();

  return res.json({ items });
}

/** Customer cancels their own pending booking. */
export async function cancelBooking(req, res) {
  const db = getDb();
  const id = new ObjectId(req.params.id);
  const booking = await db.collection("bookings").findOne({ _id: id });
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (!booking.customerId.equals(req.user._id)) {
    return res.status(404).json({ message: "Booking not found" });
  }
  if (booking.status !== "pending") {
    return res.status(400).json({ message: "Only pending bookings can be cancelled" });
  }

  await db.collection("bookings").updateOne({ _id: id }, { $set: { status: "cancelled" } });
  return res.json({ message: "Booking cancelled" });
}

/** Vendor lists their own bookings with service + customer info. */
export async function vendorBookings(req, res) {
  const db = getDb();
  const items = await db
    .collection("bookings")
    .aggregate([
      { $match: { vendorId: req.user._id } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "services",
          localField: "serviceId",
          foreignField: "_id",
          pipeline: [{ $project: { serviceName: 1, category: 1, price: 1, images: 1 } }],
          as: "service",
        },
      },
      { $unwind: "$service" },
      {
        $lookup: {
          from: "users",
          localField: "customerId",
          foreignField: "_id",
          pipeline: [{ $project: { name: 1, image: 1 } }],
          as: "customer",
        },
      },
      { $unwind: "$customer" },
    ])
    .toArray();

  return res.json({ items });
}

/** Vendor accepts or rejects a pending booking on their own service. */
export async function updateStatus(req, res) {
  const db = getDb();
  const id = new ObjectId(req.params.id);
  const booking = await db.collection("bookings").findOne({ _id: id });
  if (!booking) return res.status(404).json({ message: "Booking not found" });
  if (!booking.vendorId.equals(req.user._id)) {
    return res.status(404).json({ message: "Booking not found" });
  }
  if (booking.status !== "pending") {
    return res.status(400).json({ message: "Only pending bookings can be accepted or rejected" });
  }

  await db.collection("bookings").updateOne({ _id: id }, { $set: { status: req.body.status } });
  return res.json({ message: `Booking ${req.body.status}` });
}

/** Vendor dashboard stats. */
export async function vendorStats(req, res) {
  const db = getDb();
  const vendorId = req.user._id;
  const [totalServices, activeServices, pendingBookings, acceptedBookings] = await Promise.all([
    db.collection("services").countDocuments({ vendorId }),
    db.collection("services").countDocuments({ vendorId, isActive: true }),
    db.collection("bookings").countDocuments({ vendorId, status: "pending" }),
    db.collection("bookings").countDocuments({ vendorId, status: "accepted" }),
  ]);

  return res.json({
    totalServices,
    activeServices,
    pendingBookings,
    acceptedBookings,
    plan: getEffectivePlan(req.user),
  });
}

/** Customer dashboard stats. */
export async function customerStats(req, res) {
  const db = getDb();
  const customerId = req.user._id;
  const [total, pending, accepted, rejected] = await Promise.all([
    db.collection("bookings").countDocuments({ customerId }),
    db.collection("bookings").countDocuments({ customerId, status: "pending" }),
    db.collection("bookings").countDocuments({ customerId, status: "accepted" }),
    db.collection("bookings").countDocuments({ customerId, status: "rejected" }),
  ]);

  return res.json({ total, pending, accepted, rejected });
}
