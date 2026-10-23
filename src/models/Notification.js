import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["donation_nearby"], required: true },
    donation: { type: mongoose.Schema.Types.ObjectId, ref: "Donation", required: true },
    distanceKm: { type: Number }, // recipient's distance from the pickup point when the alert was sent
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
// One alert per recipient per donation, even if matching ever runs twice for the same listing.
notificationSchema.index({ recipient: 1, donation: 1, type: 1 }, { unique: true });
// Alerts are only useful while the food is fresh, so let Mongo clear out month-old ones.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.model("Notification", notificationSchema);
