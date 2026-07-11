import { Router } from "express";
import { getPlatformStats, getMyImpactTimeline, getLeaderboard } from "../controllers/statsController.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/platform", getPlatformStats);
router.get("/leaderboard", getLeaderboard);
router.get("/mine", protect, getMyImpactTimeline);

export default router;
