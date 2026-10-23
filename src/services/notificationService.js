import User, { NOTIFY_RADIUS_OPTIONS_KM, DEFAULT_NOTIFY_RADIUS_KM } from "../models/User.js";
import Notification from "../models/Notification.js";

const MAX_NOTIFY_RADIUS_KM = Math.max(...NOTIFY_RADIUS_OPTIONS_KM);

// Alerts every NGO/volunteer whose own notify radius covers the donation's pickup point.
export async function notifyNearbyClaimants(donation) {
  const recipients = await User.aggregate([
    {
      $geoNear: {
        near: { type: "Point", coordinates: donation.location.coordinates },
        distanceField: "distance", // metres
        maxDistance: MAX_NOTIFY_RADIUS_KM * 1000,
        query: { role: { $in: ["ngo", "volunteer"] } },
        spherical: true,
      },
    },
    // Each recipient picks their own radius. Accounts created before the setting existed have
    // no field in the raw document (Mongoose defaults don't apply inside aggregation), so
    // fall back to the default rather than silently never alerting them.
    {
      $match: {
        $expr: {
          $lte: ["$distance", { $multiply: [{ $ifNull: ["$notifyRadiusKm", DEFAULT_NOTIFY_RADIUS_KM] }, 1000] }],
        },
      },
    },
    { $project: { _id: 1, distance: 1 } },
  ]);

  if (recipients.length === 0) return 0;

  await Notification.insertMany(
    recipients.map((r) => ({
      recipient: r._id,
      type: "donation_nearby",
      donation: donation._id,
      distanceKm: Math.round(r.distance) / 1000,
    })),
    { ordered: false }
  );

  return recipients.length;
}
