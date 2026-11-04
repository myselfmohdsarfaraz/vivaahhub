const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");

router.post("/", requireAuth, async (req, res) => {
  const { listing_id, event_date, guest_count, message } = req.body || {};
  if (!listing_id || !event_date || !guest_count) {
    return res.status(400).json({ error: "Listing, event date and guest count are required." });
  }
  const guests = Number(guest_count);
  if (!Number.isInteger(guests) || guests < 1 || guests > 100000) {
    return res.status(400).json({ error: "Enter a valid guest count." });
  }
  if (Number.isNaN(Date.parse(event_date))) {
    return res.status(400).json({ error: "Enter a valid event date." });
  }

  const { data: listing, error: listingError } = await req.db
    .from("listings").select("id, vendor_id, is_published").eq("id", listing_id).single();
  if (listingError || !listing || !listing.is_published) {
    return res.status(404).json({ error: "This listing is no longer available." });
  }
  if (listing.vendor_id === req.user.id) {
    return res.status(400).json({ error: "You cannot book your own listing." });
  }

  const { data, error } = await req.db.from("bookings").insert({
    listing_id,
    vendor_id: listing.vendor_id,
    customer_id: req.user.id,
    event_date,
    guest_count: guests,
    message: typeof message === "string" ? message.slice(0, 2000) : ""
  }).select("id, status, event_date, guest_count, created_at").single();

  if (error) return res.status(500).json({ error: "Could not create booking request." });
  res.status(201).json({ booking: data, message: "Your request has been sent to the vendor." });
});

router.get("/mine", requireAuth, async (req, res) => {
  const { data, error } = await req.db
    .from("bookings")
    .select("id, event_date, guest_count, message, status, created_at, listings(title, category, city)")
    .eq("customer_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: "Could not load your booking requests." });
  res.json({ bookings: data });
});

module.exports = router;