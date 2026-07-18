import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: {
      type: String,
      enum: ["donor", "ngo", "volunteer", "admin"],
      required: true,
    },
    phone: { type: String, trim: true },
    orgName: { type: String, trim: true }, // used when role is ngo
    avatarUrl: { type: String },
    isVerifiedNgo: { type: Boolean, default: false }, // admin verifies NGOs before they can claim
    address: { type: String, trim: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
    },
    impact: {
      donationsCompleted: { type: Number, default: 0 },
      mealsShared: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

userSchema.index({ location: "2dsphere" });

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    phone: this.phone,
    orgName: this.orgName,
    avatarUrl: this.avatarUrl,
    isVerifiedNgo: this.isVerifiedNgo,
    address: this.address,
    location: this.location,
    impact: this.impact,
  };
};

export default mongoose.model("User", userSchema);
