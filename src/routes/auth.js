const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");

router.get("/me", requireAuth, async (req, res) => {
  const { data: profile, error } = await req.db
    .from("profiles")
    .select("id, full_name, role, created_at")
    .eq("id", req.user.id)
    .single();

  if (error) return res.status(500).json({ error: "Could not load your profile." });
  res.json({ user: { id: req.user.id, email: req.user.email }, profile });
});

module.exports = router;