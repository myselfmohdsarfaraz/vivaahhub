require("dotenv").config();
const path = require("path");
const express = require("express");
const helmet = require("helmet");
const { supabase } = require("./supabase");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "VivaahHub API" }));
app.get("/api/config", (_req, res) => res.json({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY
}));

app.use("/api/auth", require("./routes/auth"));
app.use("/api/listings", require("./routes/listings"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/vendor", require("./routes/vendor"));

app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));
app.get("/{*splat}", (req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found." });
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => console.log(`VivaahHub running at http://localhost:${PORT}`));