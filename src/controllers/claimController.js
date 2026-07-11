import crypto from "crypto";
import Claim from "../models/Claim.js";
import Donation from "../models/Donation.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadBuffer } from "../config/cloudinary.js";

function generateHandoffCode() {
  return crypto.randomInt(100000, 999999).toString();
}

export const claimDonation = asyncHandler(async (req, res) => {
  const donation = await Donation.findById(req.params.donationId);
  if (!donation) return res.status(404).json({ message: "Donation not found" });
  if (donation.status !== "available") {
    return res.status(400).json({ message: "This donation has already been claimed or is unavailable" });
  }

  const handoffCode = generateHandoffCode();
  const claim = await Claim.create({
    donation: donation._id,
    claimedBy: req.user._id,
    handoffCode,
    timeline: [{ status: "claimed" }],
  });

  donation.status = "claimed";
  await donation.save();

  // handoffCode is select:false on the model, so it's already excluded here -
  // the claimant must get it from the donor in person at pickup.
  res.status(201).json({ claim });
});

export const getMyClaims = asyncHandler(async (req, res) => {
  const claims = await Claim.find({ claimedBy: req.user._id })
    .populate({ path: "donation", populate: { path: "donor", select: "name orgName phone" } })
    .sort({ createdAt: -1 });
  res.json({ claims });
});

export const getClaimForDonation = asyncHandler(async (req, res) => {
  const donation = await Donation.findById(req.params.donationId);
  if (!donation) return res.status(404).json({ message: "Donation not found" });
  if (String(donation.donor) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the donor can view this donation's claim" });
  }

  const claim = await Claim.findOne({ donation: donation._id, status: { $ne: "cancelled" } })
    .select("+handoffCode")
    .populate("claimedBy", "name orgName phone role")
    .sort({ createdAt: -1 });

  if (!claim) return res.status(404).json({ message: "No active claim for this donation" });

  res.json({ claim });
});

export const updateClaimStatus = asyncHandler(async (req, res) => {
  const { status, handoffCode } = req.body;
  const allowed = ["out_for_pickup", "picked_up", "delivered", "cancelled"];
  if (!allowed.includes(status)) {
    return res.status(400).json({ message: `status must be one of: ${allowed.join(", ")}` });
  }

  const claim = await Claim.findById(req.params.id).select("+handoffCode").populate("donation");
  if (!claim) return res.status(404).json({ message: "Claim not found" });
  if (String(claim.claimedBy) !== String(req.user._id)) {
    return res.status(403).json({ message: "Only the claimant can update this claim" });
  }

  // Handoff code confirms the physical pickup actually happened, preventing a claim
  // from being marked picked_up without the donor present.
  if (status === "picked_up" && handoffCode !== claim.handoffCode) {
    return res.status(400).json({ message: "Incorrect handoff code" });
  }

  if (status === "picked_up" && req.file) {
    const uploaded = await uploadBuffer(req.file.buffer, "food-saver/pickups");
    claim.pickupPhotoUrl = uploaded.secure_url;
  }

  claim.status = status;
  claim.timeline.push({ status });
  await claim.save();

  const donation = claim.donation;
  if (status === "cancelled") {
    donation.status = "available";
  } else {
    donation.status = status;
  }
  await donation.save();

  if (status === "delivered") {
    await User.findByIdAndUpdate(donation.donor, {
      $inc: { "impact.donationsCompleted": 1, "impact.mealsShared": donation.quantity },
    });
    await User.findByIdAndUpdate(claim.claimedBy, {
      $inc: { "impact.donationsCompleted": 1 },
    });
  }

  const { handoffCode: _omit, ...publicClaim } = claim.toObject();
  res.json({ claim: publicClaim });
});
