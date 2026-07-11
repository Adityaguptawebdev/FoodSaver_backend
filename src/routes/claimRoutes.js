import { Router } from "express";
import {
  claimDonation,
  getMyClaims,
  updateClaimStatus,
  getClaimForDonation,
} from "../controllers/claimController.js";
import { protect, restrictTo } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.post("/:donationId", protect, restrictTo("ngo", "volunteer"), claimDonation);
router.get("/mine", protect, restrictTo("ngo", "volunteer"), getMyClaims);
router.get("/donation/:donationId", protect, restrictTo("donor"), getClaimForDonation);
router.patch("/:id", protect, restrictTo("ngo", "volunteer"), upload.single("photo"), updateClaimStatus);

export default router;
