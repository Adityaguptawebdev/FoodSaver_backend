import mongoose from "mongoose";

const claimSchema = new mongoose.Schema(
  {
    donation: { type: mongoose.Schema.Types.ObjectId, ref: "Donation", required: true },
    claimedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["claimed", "out_for_pickup", "picked_up", "delivered", "cancelled"],
      default: "claimed",
    },
    // Shown only to the donor; the claimant must obtain it in person at pickup and
    // submit it back to confirm the handoff, so it's excluded from queries by default.
    handoffCode: { type: String, required: true, select: false },
    pickupPhotoUrl: { type: String }, // proof-of-pickup photo, attached when marked picked_up
    timeline: [
      {
        status: String,
        at: { type: Date, default: Date.now },
      },
    ],
    rating: { type: Number, min: 1, max: 5 },
    feedback: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model("Claim", claimSchema);
