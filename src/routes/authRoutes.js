import { Router } from "express";
import { register, login, googleAuth, getMe, updateMe } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { upload } from "../middleware/upload.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.get("/me", protect, getMe);
router.patch("/me", protect, upload.single("avatar"), updateMe);

export default router;
