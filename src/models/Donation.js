import mongoose from "mongoose";

const donationSchema = new mongoose.Schema(
  {
    donor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    foodType: {
      type: String,
      enum: ["veg", "non-veg", "vegan"],
      required: true,
    },
    quantity: { type: Number, required: true, min: 1 },
    unit: { type: String, enum: ["servings", "kg", "packets"], default: "servings" },
    photoUrl: { type: String },
    preparedAt: { type: Date, default: Date.now },
    safeUntil: { type: Date, required: true }, // safe-to-eat window end
    pickupAddress: { type: String, required: true, trim: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]
    },
    status: {
      type: String,
      enum: ["available", "claimed", "out_for_pickup", "picked_up", "delivered", "expired", "cancelled"],
      default: "available",
    },
    ai: {
      category: { type: String },
      allergens: { type: [String], default: [] },
      shelfLifeNote: { type: String },
      generatedDescription: { type: String },
      estimatedServings: { type: Number },
    },
  },
  { timestamps: true }
);

donationSchema.index({ location: "2dsphere" });
donationSchema.index({ status: 1, safeUntil: 1 });

export default mongoose.model("Donation", donationSchema);
