// controllers/orbitalFeed.controller.js
//
// GET /api/orbitals/feed?cursor=<lastPostId>&limit=10
// Posts from every orbital the signed-in user belongs to, newest first.
//
// ⚠️ ASSUMPTIONS — rename to match your schemas:
//   OrbitalMember: { user, orbital, status }  (status 'approved' = real member, pending requests excluded)
//   Post:          { user (author), orbital, ... }   → populate('user') below
//   req.user._id   comes from your auth middleware
// Also run the result through the same response mapping your normal feed endpoint uses
// (e.g. video URL rewriting), otherwise orbital posts will look different from feed posts.

const Post = require('../models/Post');
const OrbitalMember = require('../models/OrbitalMember');

exports.getOrbitalFeed = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 30);

    const memberships = await OrbitalMember.find({ user: req.user._id, status: 'approved' })
      .select('orbital')
      .lean();
    const orbitalIds = memberships.map((m) => m.orbital);
    if (orbitalIds.length === 0) return res.json({ posts: [], nextCursor: null });

    const query = { orbital: { $in: orbitalIds } };
    if (req.query.cursor) query._id = { $lt: req.query.cursor }; // ObjectIds sort by creation time

    // fetch one extra to know whether another page exists
    const rows = await Post.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .populate('user', 'username profilePic')
      .populate('orbital', 'name image')
      .lean();

    const hasMore = rows.length > limit;
    const posts = hasMore ? rows.slice(0, limit) : rows;

    res.json({ posts, nextCursor: hasMore ? String(posts[posts.length - 1]._id) : null });
  } catch (err) {
    res.status(500).json({ message: 'Failed to load orbital feed' });
  }
};

// routes/orbital.routes.js — IMPORTANT: register this BEFORE any '/:id' route, or "feed" is read as an id
//   router.get('/feed', auth, getOrbitalFeed);
