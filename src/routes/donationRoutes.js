import { Router } from "express";
import {
  createDonation,
  listNearbyDonations,
  listRecentDonations,
  getMyDonations,
  getDonation,
  cancelDonation,
  previewAiTags,
} from "../controllers/donationController.js";
import { protect, restrictTo } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.get("/recent", listRecentDonations);
router.get("/", protect, listNearbyDonations);
router.get("/mine", protect, restrictTo("donor"), getMyDonations);
router.post("/ai-preview", protect, restrictTo("donor"), upload.single("photo"), previewAiTags);
router.get("/:id", protect, getDonation);
router.post("/", protect, restrictTo("donor"), upload.single("photo"), createDonation);
router.patch("/:id/cancel", protect, restrictTo("donor"), cancelDonation);

export default router;
