const express = require("express");
const router = express.Router();
const { supabase } = require("../supabase");

router.get("/", async (req, res) => {
  const { category, city, guests, q } = req.query;
  let query = supabase
    .from("listings")
    .select("id, vendor_id, title, category, city, description, starting_price, max_guests, whatsapp_number, image_url, created_at, vendors:profiles!listings_vendor_id_fkey(full_name)")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (category && category !== "all") query = query.eq("category", category);
  if (city) query = query.ilike("city", `%${city}%`);
  if (guests && Number.isFinite(Number(guests))) query = query.gte("max_guests", Number(guests));
  if (q) query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: "Could not load listings." });
  res.json({ listings: data });
});

router.get("/:id", async (req, res) => {
  const { data, error } = await supabase
    .from("listings")
    .select("*, vendors:profiles!listings_vendor_id_fkey(full_name)")
    .eq("id", req.params.id)
    .eq("is_published", true)
    .single();

  if (error || !data) return res.status(404).json({ error: "Listing not found." });
  res.json({ listing: data });
});

module.exports = router;