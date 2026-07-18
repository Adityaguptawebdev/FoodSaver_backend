import User from "../models/User.js";
import { generateToken } from "../utils/generateToken.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadBuffer } from "../config/cloudinary.js";

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
  const user = await User.findOne({ email: email?.toLowerCase() }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  res.json({
    token: generateToken(user._id),
    user: user.toPublicJSON(),
  });
});

export const getMe = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toPublicJSON() });
});

export const updateMe = asyncHandler(async (req, res) => {
  const { name, phone, orgName, address, lng, lat } = req.body;
  const user = req.user;

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
