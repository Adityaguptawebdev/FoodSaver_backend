import Notification from "../models/Notification.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const listMyNotifications = asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ recipient: req.user._id })
      .populate("donation", "title photoUrl status foodType quantity unit pickupAddress")
      .sort({ createdAt: -1 })
      .limit(limit),
    Notification.countDocuments({ recipient: req.user._id, readAt: null }),
  ]);

  res.json({ notifications, unreadCount });
});

// Lightweight endpoint the navbar polls, so it doesn't refetch the whole list every time.
// latestAt lets the client tell a brand-new alert apart from a changed unread count (e.g. to
// chime only when something new arrives).
export const getUnreadCount = asyncHandler(async (req, res) => {
  const [count, latest] = await Promise.all([
    Notification.countDocuments({ recipient: req.user._id, readAt: null }),
    Notification.findOne({ recipient: req.user._id }).sort({ createdAt: -1 }).select("createdAt"),
  ]);
  res.json({ count, latestAt: latest?.createdAt ?? null });
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findOne({ _id: req.params.id, recipient: req.user._id });
  if (!notification) return res.status(404).json({ message: "Notification not found" });

  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
  res.json({ notification });
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany(
    { recipient: req.user._id, readAt: null },
    { $set: { readAt: new Date() } }
  );
  res.json({ updated: result.modifiedCount });
});
