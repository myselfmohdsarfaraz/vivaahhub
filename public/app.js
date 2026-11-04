let supabaseClient = null;
let accessToken = null;
let currentUser = null;
let currentProfile = null;
let selectedListing = null;
let authMode = "signup";

const $ = (id) => document.getElementById(id);
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
const money = value => "₹" + Number(value || 0).toLocaleString("en-IN");
let listingsCache = {};

function buildWhatsAppLink(vendorPhone, enquiry) {
  const text =
`New booking request on VivaahHub
Service: ${enquiry.service}
Date: ${enquiry.event_date}
City: ${enquiry.city}
Guests: ${enquiry.guest_count}
Details: ${enquiry.message || "-"}`;
  return `https://wa.me/${vendorPhone}?text=${encodeURIComponent(text)}`;
}
async function api(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const response = await fetch(path, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Something went wrong.");
  return payload;
}

async function boot() {
  $("year").textContent = new Date().getFullYear();
  try {
    const config = await api("/api/config");
    if (!window.supabase || !config.supabaseUrl || !config.supabaseAnonKey) throw new Error("Supabase is not configured yet. Add the values in your .env file.");
    supabaseClient = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { data } = await supabaseClient.auth.getSession();
    if (data.session) await setSession(data.session);
    await loadListings();
  } catch (error) {
    $("listingGrid").innerHTML = `<div class="empty">${escapeHtml(error.message)} Listings will appear after the database is configured.</div>`;
    $("listingCount").textContent = "Setup needed";
  }
}
async function setSession(session) {
  accessToken = session?.access_token || null;
  currentUser = session?.user || null;
  if (currentUser) {
    try {
      const result = await api("/api/auth/me");
      currentProfile = result.profile;
    } catch { currentProfile = null; }
  } else currentProfile = null;
  renderAccount();
}
function renderAccount() {
  $("accountActions").hidden = !!currentUser;
  $("signedIn").hidden = !currentUser;
  if (currentUser) {
    $("welcomeName").textContent = `Hi, ${currentProfile?.full_name || currentUser.email}`;
    $("dashboardOpen").hidden = currentProfile?.role !== "vendor";
  }
}
function openOverlay(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
function closeOverlays() { document.querySelectorAll(".overlay").forEach(el => el.hidden = true); document.body.style.overflow = ""; }
document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", closeOverlays));
document.querySelectorAll(".overlay").forEach(el => el.addEventListener("click", e => { if (e.target === el) closeOverlays(); }));
document.addEventListener("keydown", e => { if (e.key === "Escape") closeOverlays(); });

function openAuth(mode = "signup", role = "customer") {
  authMode = mode;
  $("authTitle").textContent = mode === "signup" ? "Create your account." : "Welcome back.";
  document.querySelectorAll(".signup-only").forEach(el => el.hidden = mode !== "signup");
  $("authRole").value = role;
  $("authPassword").autocomplete = mode === "signup" ? "new-password" : "current-password";
  $("authSubmit").textContent = mode === "signup" ? "Create account" : "Log in";
  $("authMessage").textContent = "";
  openOverlay("authOverlay");
}
$("loginOpen").addEventListener("click", () => openAuth("login"));
$("signupOpen").addEventListener("click", () => openAuth("signup"));
$("vendorSignup").addEventListener("click", () => openAuth("signup", "vendor"));
$("switchAuth").addEventListener("click", () => openAuth(authMode === "signup" ? "login" : "signup"));

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  if (!supabaseClient) return;
  $("authSubmit").disabled = true;
  $("authMessage").textContent = "Please wait…";
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  try {
    let result;
    if (authMode === "signup") {
      result = await supabaseClient.auth.signUp({
        email, password,
        options: { data: { full_name: $("authName").value.trim(), role: $("authRole").value } }
      });
      if (result.error) throw result.error;
      if (!result.data.session) {
        $("authMessage").textContent = "Account created. Check your email to confirm it, then log in.";
      } else {
        await setSession(result.data.session); closeOverlays();
      }
    } else {
      result = await supabaseClient.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      await setSession(result.data.session); closeOverlays();
    }
  } catch (error) { $("authMessage").textContent = error.message; }
  finally { $("authSubmit").disabled = false; }
});
$("logoutBtn").addEventListener("click", async () => {
  if (supabaseClient) await supabaseClient.auth.signOut();
  await setSession(null);
  closeOverlays();
});
if (window.supabase) {
  // Auth changes from another tab/device are reflected in the header.
  // Initial session is loaded during boot().
}

async function loadListings(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const result = await api(`/api/listings?${params.toString()}`);
  const items = result.listings || [];
  items.forEach(item => { listingsCache[item.id] = item; });
  $("listingCount").textContent = `${items.length} listing${items.length === 1 ? "" : "s"} found`;
  $("listingGrid").innerHTML = items.length ? items.map(item => `
    <article class="listing-card">
      <div class="listing-image" style="background-image:url('${escapeHtml(item.image_url || "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80")}')"><span>${escapeHtml(item.category.toUpperCase())}</span></div>
      <div class="listing-body"><div class="listing-meta"><span>${escapeHtml(item.city)}</span><span>Vendor listing</span></div>
      <h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p>
      <div class="listing-foot"><strong>${money(item.starting_price)} <small>starting price</small></strong><button data-book="${escapeHtml(item.id)}">Enquire ↗</button></div></div>
    </article>`).join("") : `<div class="empty">No published listings match your search yet. Try another city or category.</div>`;
  document.querySelectorAll("[data-book]").forEach(button => button.addEventListener("click", () => beginBooking(button.dataset.book)));
}
$("searchForm").addEventListener("submit", async e => {
  e.preventDefault();
  try { await loadListings({ category: $("category").value, city: $("city").value.trim(), guests: $("guests").value }); }
  catch (error) { $("listingGrid").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
});

async function beginBooking(listingId) {
  if (!currentUser) return openAuth("login");
  if (currentProfile?.role === "vendor") {
    alert("Please use a customer account to send a booking request.");
    return;
  }
  selectedListing = listingId;
  $("bookingMessageStatus").textContent = "";
  openOverlay("bookingOverlay");
}
$("bookingForm").addEventListener("submit", async e => {
  e.preventDefault();
  const button = e.submitter;
  button.disabled = true;
  $("bookingMessageStatus").textContent = "Sending request…";
  try {
    const listing = listingsCache[selectedListing] || {};
    const details = {
      service: listing.title || listing.category,
      event_date: $("eventDate").value,
      city: listing.city,
      guest_count: Number($("guestCount").value),
      message: $("bookingMessage").value
    };
    const result = await api("/api/bookings", { method: "POST", body: JSON.stringify({
      listing_id: selectedListing, event_date: details.event_date,
      guest_count: details.guest_count, message: details.message
    })});
    e.target.reset();
    const status = $("bookingMessageStatus");
    status.textContent = result.message || "Request sent.";
    if (listing.whatsapp_number) {
      const link = document.createElement("a");
      link.href = buildWhatsAppLink(listing.whatsapp_number, details);
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = " Also send these details on WhatsApp ↗";
      status.appendChild(link);
    }
  } catch (error) { $("bookingMessageStatus").textContent = error.message; }
  finally { button.disabled = false; }
});

$("dashboardOpen").addEventListener("click", openDashboard);
document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b === button));
  renderDashboardTab(button.dataset.tab);
}));
async function openDashboard() {
  if (!currentUser || currentProfile?.role !== "vendor") return;
  document.querySelectorAll("[data-tab]").forEach(b => b.classList.toggle("active", b.dataset.tab === "enquiries"));
  openOverlay("dashboardOverlay");
  await renderDashboardTab("enquiries");
}
async function renderDashboardTab(tab) {
  const host = $("dashboardContent");
  host.innerHTML = `<div class="loading">Loading your workspace…</div>`;
  try {
    if (tab === "enquiries") {
      const { bookings } = await api("/api/vendor/bookings");
      host.innerHTML = bookings.length ? bookings.map(b => `
        <div class="dashboard-item"><div><h4>${escapeHtml(b.listings?.title || "Listing enquiry")}</h4><p>${escapeHtml(b.customer?.full_name || "Customer")} · ${escapeHtml(b.event_date)} · ${b.guest_count} guests</p><p>${escapeHtml(b.message || "No additional message")}</p></div>
        <div><span class="status">${escapeHtml(b.status)}</span>${b.status === "pending" ? `<div><button class="btn primary" data-status="${b.id}" data-value="accepted">Accept</button><button class="btn ghost" data-status="${b.id}" data-value="rejected">Decline</button></div>` : ""}</div></div>`).join("") : `<div class="empty">No enquiries yet. When a customer sends a request, it will appear here.</div>`;
      host.querySelectorAll("[data-status]").forEach(btn => btn.addEventListener("click", async () => {
        try { await api(`/api/vendor/bookings/${btn.dataset.status}/status`, { method: "PATCH", body: JSON.stringify({ status: btn.dataset.value }) }); await renderDashboardTab("enquiries"); }
        catch (error) { alert(error.message); }
      }));
    } else if (tab === "myListings") {
      const { listings } = await api("/api/vendor/listings");
      host.innerHTML = listings.length ? listings.map(l => `<div class="dashboard-item"><div><h4>${escapeHtml(l.title)}</h4><p>${escapeHtml(l.category)} · ${escapeHtml(l.city)} · ${money(l.starting_price)}</p></div><span class="status">${l.is_published ? "Published" : "Draft"}</span></div>`).join("") : `<div class="empty">You haven't added a listing yet.</div>`;
    } else {
      host.innerHTML = `<form id="newListingForm" class="inline-form">
        <label>Business / service name<input name="title" required></label>
        <label>Category<select name="category"><option value="venue">Venue</option><option value="catering">Catering</option><option value="photography">Photography</option><option value="decor">Decor</option><option value="makeup">Makeup</option><option value="planning">Planning</option><option value="other">Other</option></select></label>
        <label>City<input name="city" required></label><label>Starting price (₹)<input name="starting_price" type="number" min="0" value="0"></label>
        <label>Maximum guests<input name="max_guests" type="number" min="0" value="0"></label><label>Image URL (optional)<input name="image_url" type="url" placeholder="https://…"></label>
        <label>WhatsApp number (with country code, no +)<input name="whatsapp_number" inputmode="numeric" pattern="[0-9]{10,15}" placeholder="919876543210"></label>
        <label>Description<textarea name="description" rows="3" required></textarea></label>
        <label><input name="is_published" type="checkbox" checked style="display:inline;width:auto"> Publish listing now</label>
        <button class="btn primary full">Create listing</button><p id="listingFormMessage" class="form-message"></p></form>`;
      $("newListingForm").addEventListener("submit", async e => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const payload = Object.fromEntries(formData.entries());
        payload.starting_price = Number(payload.starting_price || 0);
        payload.max_guests = Number(payload.max_guests || 0);
        payload.whatsapp_number = formData.get("whatsapp_number");
        payload.is_published = formData.has("is_published");
        try { await api("/api/vendor/listings", { method: "POST", body: JSON.stringify(payload) }); await renderDashboardTab("myListings"); }
        catch (error) { $("listingFormMessage").textContent = error.message; }
      });
    }
  } catch (error) { host.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`; }
}

boot();