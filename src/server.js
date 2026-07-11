import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";

import { connectDB } from "./config/db.js";
import Donation from "./models/Donation.js";
import authRoutes from "./routes/authRoutes.js";
import donationRoutes from "./routes/donationRoutes.js";
import claimRoutes from "./routes/claimRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json());
app.use(morgan("dev"));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/api/health", (req, res) => res.json({ ok: true }));
app.use("/api/auth", authRoutes);
app.use("/api/donations", donationRoutes);
app.use("/api/claims", claimRoutes);
app.use("/api/stats", statsRoutes);

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  await connectDB();

  // Sweep past-safe-window donations every 5 minutes so stale listings don't
  // stay claimable once the food is no longer considered safe to eat.
  setInterval(async () => {
    await Donation.updateMany(
      { status: "available", safeUntil: { $lt: new Date() } },
      { $set: { status: "expired" } }
    );
  }, 5 * 60 * 1000);

  app.listen(PORT, () => console.log(`Food Saver API running on port ${PORT}`));
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
