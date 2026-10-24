import { OAuth2Client } from "google-auth-library";
import User, { NOTIFY_RADIUS_OPTIONS_KM } from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadBuffer } from "../config/cloudinary.js";

const googleClient = new OAuth2Client();

// Roles a user can pick for themselves. Admins are never self-created.
const SELF_SERVE_ROLES = ["donor", "ngo", "volunteer"];

// Web and Android ID tokens carry the web client ID as their audience; iOS tokens
// carry the iOS client ID. So the server accepts a comma-separated list.
function googleAudiences() {
  return (process.env.GOOGLE_CLIENT_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, orgName, address, lng, lat } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ message: "name, email, password and role are required" });
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return res.status(409).json({ message: "An account with this email already exists" });
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    orgName,
    address,
    location: {
      type: "Point",
      coordinates: [Number(lng) || 0, Number(lat) || 0],
    },
  });

  res.status(201).json({
    token: generateToken(user._id),
    user: user.toPublicJSON(),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+password");

  if (user && !user.password) {
    return res.status(401).json({ message: "This account uses Google sign-in. Continue with Google instead." });
  }

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  res.json({
    token: generateToken(user._id),
    user: user.toPublicJSON(),
  });
});

// Sign in or sign up with a Google ID token (from the web button or the mobile SDK).
// A first-time user has no role yet, so the first call answers { needsRole: true } and
// the client calls again with the same idToken plus role and profile fields.
export const googleAuth = asyncHandler(async (req, res) => {
  const { idToken, name, role, phone, orgName, address, lng, lat } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: "idToken is required" });
  }

  const audience = googleAudiences();
  if (audience.length === 0) {
    return res.status(503).json({ message: "Google sign-in is not configured on the server" });
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ message: "Invalid or expired Google token" });
  }

  if (!payload?.email || !payload.email_verified) {
    return res.status(401).json({ message: "Your Google email address is not verified" });
  }

  const { sub: googleId, name: googleName, picture } = payload;
  const email = payload.email.toLowerCase();

  let user = await User.findOne({ googleId });

  if (!user) {
    user = await User.findOne({ email });
    if (user) {
      if (user.googleId) {
        return res.status(409).json({ message: "This email is linked to a different Google account" });
      }
      // Google has verified the email, so attaching Google to the existing account is safe.
      user.googleId = googleId;
      if (!user.avatarUrl && picture) user.avatarUrl = picture;
      await user.save();
    }
  }

  if (user) {
    return res.json({
      token: generateToken(user._id),
      user: user.toPublicJSON(),
    });
  }

  if (!role) {
    return res.json({
      needsRole: true,
      profile: { name: googleName, email, avatarUrl: picture },
    });
  }

  if (!SELF_SERVE_ROLES.includes(role)) {
    return res.status(400).json({ message: `role must be one of: ${SELF_SERVE_ROLES.join(", ")}` });
  }

  user = await User.create({
    name: name || googleName || email.split("@")[0],
    email,
    googleId,
    role,
    phone,
    orgName,
    address,
    avatarUrl: picture,
    location: {
      type: "Point",
      coordinates: [Number(lng) || 0, Number(lat) || 0],
    },
  });

  res.status(201).json({
    token: generateToken(user._id),
    user: user.toPublicJSON(),
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, phone, orgName, address, lng, lat, notifyRadiusKm } = req.body;
  const user = req.user;

  if (notifyRadiusKm !== undefined) {
    const radius = Number(notifyRadiusKm);
    if (!NOTIFY_RADIUS_OPTIONS_KM.includes(radius)) {
      return res.status(400).json({ message: `notifyRadiusKm must be one of: ${NOTIFY_RADIUS_OPTIONS_KM.join(", ")}` });
    }
    user.notifyRadiusKm = radius;
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (orgName !== undefined) user.orgName = orgName;
  if (address !== undefined) user.address = address;
  if (lng !== undefined && lat !== undefined) {
    user.location = { type: "Point", coordinates: [Number(lng), Number(lat)] };
  }

  if (req.file) {
    const uploaded = await uploadBuffer(req.file.buffer, "food-saver/avatars");
    user.avatarUrl = uploaded.secure_url;
  }

  await user.save();
  res.json({ user: user.toPublicJSON() });
});
