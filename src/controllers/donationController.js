import Donation from "../models/Donation.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { enrichDonation } from "../services/geminiService.js";
import { uploadBuffer } from "../config/cloudinary.js";

export const createDonation = asyncHandler(async (req, res) => {
  const { title, description, foodType, quantity, unit, safeUntil, pickupAddress, lng, lat } = req.body;

  if (!title || !foodType || !quantity || !safeUntil || !pickupAddress || lng === undefined || lat === undefined) {
    return res.status(400).json({
      message: "title, foodType, quantity, safeUntil, pickupAddress, lng and lat are required",
    });
  }

  let photoUrl;
  if (req.file) {
    const uploaded = await uploadBuffer(req.file.buffer, "food-saver/donations");
    photoUrl = uploaded.secure_url;
  }

  const donation = await Donation.create({
    donor: req.user._id,
    title,
    description,
    foodType,
    quantity,
    unit,
    safeUntil,
    pickupAddress,
    photoUrl,
    location: { type: "Point", coordinates: [Number(lng), Number(lat)] },
  });

  // AI enrichment is best-effort and must never block the donation from being created.
  const aiTags = await enrichDonation(donation, req.file);
  if (aiTags) {
    donation.ai = aiTags;
    await donation.save();
  }

  res.status(201).json({ donation });
});

export const listNearbyDonations = asyncHandler(async (req, res) => {
  const { lng, lat, radiusKm = 10, status = "available" } = req.query;

  const filter = { status };
  if (lng !== undefined && lat !== undefined) {
    filter.location = {
      $near: {
        $geometry: { type: "Point", coordinates: [Number(lng), Number(lat)] },
        $maxDistance: Number(radiusKm) * 1000,
      },
    };
  }

  const donations = await Donation.find(filter)
    .populate("donor", "name orgName phone")
    .sort({ createdAt: -1 });

  res.json({ donations });
});

export const listRecentDonations = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 9, 24);
  const donations = await Donation.find({ status: { $in: ["available", "claimed", "out_for_pickup", "picked_up", "delivered"] } })
    .populate("donor", "name orgName")
    .sort({ createdAt: -1 })
    .limit(limit);

  res.json({ donations });
});

export const getMyDonations = asyncHandler(async (req, res) => {
  const donations = await Donation.find({ donor: req.user._id }).sort({ createdAt: -1 });
  res.json({ donations });
});

export const getDonation = asyncHandler(async (req, res) => {
  const donation = await Donation.findById(req.params.id).populate("donor", "name orgName phone");
  if (!donation) return res.status(404).json({ message: "Donation not found" });
  res.json({ donation });
});

export const cancelDonation = asyncHandler(async (req, res) => {
  const donation = await Donation.findById(req.params.id);
  if (!donation) return res.status(404).json({ message: "Donation not found" });
  if (String(donation.donor) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the donor can cancel this donation" });
  }
  if (donation.status !== "available") {
    return res.status(400).json({ message: "Only available donations can be cancelled" });
  }
  donation.status = "cancelled";
  await donation.save();
  res.json({ donation });
});
