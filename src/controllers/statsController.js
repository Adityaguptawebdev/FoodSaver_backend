import Donation from "../models/Donation.js";
import Claim from "../models/Claim.js";
import User from "../models/User.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getPlatformStats = asyncHandler(async (req, res) => {
  const [mealsAgg, donationsCompleted, activeDonations, ngoCount] = await Promise.all([
    Donation.aggregate([
      { $match: { status: "delivered" } },
      { $group: { _id: null, totalServings: { $sum: "$quantity" } } },
    ]),
    Donation.countDocuments({ status: "delivered" }),
    Donation.countDocuments({ status: "available" }),
    Claim.distinct("claimedBy"),
  ]);

  res.json({
    mealsShared: mealsAgg[0]?.totalServings || 0,
    donationsCompleted,
    activeDonations,
    activeOrganizations: ngoCount.length,
  });
});

export const getMyImpactTimeline = asyncHandler(async (req, res) => {
  const isDonor = req.user.role === "donor";
  const isOrg = req.user.role === "ngo" || req.user.role === "volunteer";

  const timeline = isDonor
    ? await Donation.aggregate([
        { $match: { donor: req.user._id, status: "delivered" } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
            meals: { $sum: "$quantity" },
            donations: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ])
    : [];

  let rank = null;
  if (isDonor && req.user.impact.mealsShared > 0) {
    const higher = await User.countDocuments({
      role: "donor",
      "impact.mealsShared": { $gt: req.user.impact.mealsShared },
    });
    rank = higher + 1;
  } else if (isOrg && req.user.impact.donationsCompleted > 0) {
    const higher = await User.countDocuments({
      role: { $in: ["ngo", "volunteer"] },
      "impact.donationsCompleted": { $gt: req.user.impact.donationsCompleted },
    });
    rank = higher + 1;
  }

  res.json({
    timeline: timeline.map((t) => ({ date: t._id, meals: t.meals, donations: t.donations })),
    rank,
  });
});

const PERIODS = ["today", "week", "month", "all"];

function getPeriodStart(period) {
  const d = new Date();
  if (period === "today") {
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "week") {
    d.setDate(d.getDate() - 6);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (period === "month") {
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  }
  return null; // all-time
}

export const getLeaderboard = asyncHandler(async (req, res) => {
  const period = PERIODS.includes(req.query.period) ? req.query.period : "all";

  if (period === "all") {
    const [topDonors, topOrgs] = await Promise.all([
      User.find({ role: "donor", "impact.mealsShared": { $gt: 0 } })
        .sort({ "impact.mealsShared": -1 })
        .limit(10)
        .select("name orgName impact"),
      User.find({ role: { $in: ["ngo", "volunteer"] }, "impact.donationsCompleted": { $gt: 0 } })
        .sort({ "impact.donationsCompleted": -1 })
        .limit(10)
        .select("name orgName role isVerifiedNgo impact"),
    ]);

    return res.json({
      period,
      topDonors: topDonors.map((u) => ({
        id: u._id,
        name: u.name,
        orgName: u.orgName,
        mealsShared: u.impact.mealsShared,
        donationsCompleted: u.impact.donationsCompleted,
      })),
      topOrgs: topOrgs.map((u) => ({
        id: u._id,
        name: u.name,
        orgName: u.orgName,
        role: u.role,
        isVerified: u.isVerifiedNgo,
        donationsCompleted: u.impact.donationsCompleted,
      })),
    });
  }

  const periodStart = getPeriodStart(period);

  const [donorAgg, orgAgg] = await Promise.all([
    Donation.aggregate([
      { $match: { status: "delivered", updatedAt: { $gte: periodStart } } },
      { $group: { _id: "$donor", mealsShared: { $sum: "$quantity" }, donationsCompleted: { $sum: 1 } } },
      { $sort: { mealsShared: -1 } },
      { $limit: 10 },
    ]),
    Claim.aggregate([
      { $match: { status: "delivered", updatedAt: { $gte: periodStart } } },
      { $group: { _id: "$claimedBy", donationsCompleted: { $sum: 1 } } },
      { $sort: { donationsCompleted: -1 } },
      { $limit: 10 },
    ]),
  ]);

  const [donorUsers, orgUsers] = await Promise.all([
    User.find({ _id: { $in: donorAgg.map((d) => d._id) } }).select("name orgName"),
    User.find({ _id: { $in: orgAgg.map((o) => o._id) } }).select("name orgName role isVerifiedNgo"),
  ]);
  const donorMap = Object.fromEntries(donorUsers.map((u) => [String(u._id), u]));
  const orgMap = Object.fromEntries(orgUsers.map((u) => [String(u._id), u]));

  res.json({
    period,
    topDonors: donorAgg
      .filter((d) => donorMap[String(d._id)])
      .map((d) => ({
        id: d._id,
        name: donorMap[String(d._id)].name,
        orgName: donorMap[String(d._id)].orgName,
        mealsShared: d.mealsShared,
        donationsCompleted: d.donationsCompleted,
      })),
    topOrgs: orgAgg
      .filter((o) => orgMap[String(o._id)])
      .map((o) => ({
        id: o._id,
        name: orgMap[String(o._id)].name,
        orgName: orgMap[String(o._id)].orgName,
        role: orgMap[String(o._id)].role,
        isVerified: orgMap[String(o._id)].isVerifiedNgo,
        donationsCompleted: o.donationsCompleted,
      })),
  });
});
