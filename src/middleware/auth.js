const { supabase, userClient } = require("../supabase");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Sign in to continue." });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });

  req.user = data.user;
  req.accessToken = token;
  req.db = userClient(token);
  next();
}

async function requireVendor(req, res, next) {
  const { data, error } = await req.db
    .from("profiles")
    .select("role")
    .eq("id", req.user.id)
    .single();

  if (error || !data || data.role !== "vendor") {
    return res.status(403).json({ error: "A vendor account is required for this action." });
  }
  next();
}

module.exports = { requireAuth, requireVendor };