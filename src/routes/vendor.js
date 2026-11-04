const express = require("express");
const router = express.Router();
const { requireAuth, requireVendor } = require("../middleware/auth");

router.use(requireAuth, requireVendor);

router.get("/listings", async (req, res) => {
  const { data, error } = await req.db.from("listings").select("*").eq("vendor_id", req.user.id).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Could not load your listings." });
  res.json({ listings: data });
});

router.post("/listings", async (req, res) => {
  const { title, category, city, description, starting_price, max_guests, whatsapp_number, image_url, is_published } = req.body || {};
  const allowed = ["venue", "catering", "photography", "decor", "makeup", "planning", "other"];
  if (!title || !category || !city || !description) return res.status(400).json({ error: "Title, category, city and description are required." });
  if (!allowed.includes(category)) return res.status(400).json({ error: "Choose a valid service category." });
  const price = Number(starting_price || 0);
  const capacity = Number(max_guests || 0);
  if (price < 0 || capacity < 0) return res.status(400).json({ error: "Price and guest capacity cannot be negative." });

    const { data, error } = await req.db.from("listings").insert({
    vendor_id: req.user.id, title, category, city, description,
    starting_price: price, max_guests: capacity,
whatsapp_number: (() => {
  const digits = String(whatsapp_number || "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return null;
  return digits.length === 10 ? "91" + digits : digits;
})(),    image_url: image_url || null, is_published: Boolean(is_published)
  }).select("*").single();

  if (error) return res.status(500).json({ error: "Could not create listing." });
  res.status(201).json({ listing: data });
});

router.patch("/listings/:id", async (req, res) => {
  const allowedFields = ["title", "category", "city", "description", "starting_price", "max_guests", "whatsapp_number", "image_url", "is_published"];
  const updates = {};
  for (const key of allowedFields) if (req.body && req.body[key] !== undefined) updates[key] = req.body[key];
  if (!Object.keys(updates).length) return res.status(400).json({ error: "No valid listing fields supplied." });

  const { data, error } = await req.db.from("listings").update(updates)
    .eq("id", req.params.id).eq("vendor_id", req.user.id).select("*").single();
  if (error || !data) return res.status(404).json({ error: "Listing not found or could not be updated." });
  res.json({ listing: data });
});

router.get("/bookings", async (req, res) => {
  const { data, error } = await req.db.from("bookings")
    .select("id, event_date, guest_count, message, status, created_at, listings(title, category, city), customer:profiles!bookings_customer_id_fkey(full_name)")
    .eq("vendor_id", req.user.id).order("created_at", { ascending: false });
  if (error) return res.status(500).json({ error: "Could not load enquiries." });
  res.json({ bookings: data });
});

router.patch("/bookings/:id/status", async (req, res) => {
  const { status } = req.body || {};
  if (!["accepted", "rejected"].includes(status)) return res.status(400).json({ error: "Status must be accepted or rejected." });
  const { data, error } = await req.db.from("bookings").update({ status })
    .eq("id", req.params.id).eq("vendor_id", req.user.id).eq("status", "pending")
    .select("id, status").single();
  if (error || !data) return res.status(404).json({ error: "Pending enquiry not found." });
  res.json({ booking: data });
});

module.exports = router;