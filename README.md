# VivaahHub — Milestone 2 (Backend + Database + Accounts)

This milestone connects the redesigned frontend to a Node.js/Express API and Supabase PostgreSQL.

## Features in this milestone
- Supabase Auth sign-up and login (customer/vendor role)
- Public listing discovery with category, city and guest-capacity filters
- Vendor listing creation and publishing
- Customer booking/enquiry requests stored in PostgreSQL
- Vendor dashboard to view enquiries and accept/decline pending requests
- Row Level Security (RLS) policies for profiles, listings and bookings
this also solve the problem of booking of marriage hall
## Requirements
- Node.js 20+
- VS Code (recommended)
- A Supabase account and project

## Step 1 — Create Supabase project
1. Create a project at https://supabase.com.
2. Open **Project Settings → API** (or API Keys).
3. Copy the Project URL and the publishable/anon key.
4. In **SQL Editor**, open a new query, paste all of `supabase/schema.sql`, and run it.
5. In **Authentication → URL Configuration**, set the Site URL to your local app URL while developing (for example `http://localhost:3000`). Add your production URL later.
6. For a simple first test, you may turn email confirmation off in Auth settings. For a public launch, keep email confirmation on and configure SMTP properly.

## Step 2 — Configure the project
1. Extract the ZIP and open this folder in VS Code.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Copy `.env.example` to a new file named `.env`.
5. Put your Supabase Project URL and publishable/anon key into `.env`.

Example:
```env
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Never use the `service_role` / secret key. Do not commit `.env` to GitHub.

## Step 3 — Start the website
```bash
npm run dev
```
Open `http://localhost:3000`.
Check `http://localhost:3000/api/health`; it should return `{"status":"ok","service":"VivaahHub API"}`.

## Step 4 — Test the flow
1. Create a customer account and log in.
2. Create a second account and select **wedding professional**.
3. Log in as the vendor, open **Vendor dashboard → Add a listing**, and publish a listing.
4. Log out and log in as the customer.
5. Search for the vendor listing and send an enquiry with event date and guest count.
6. Log back in as the vendor and accept or decline the enquiry.

If email confirmation is enabled, confirm the signup email before logging in.

## API routes
| Method | Route | Purpose |
|---|---|---|
| GET | `/api/health` | API health check |
| GET | `/api/config` | Supplies public Supabase URL/key to browser |
| GET | `/api/listings` | Public listing search |
| GET | `/api/listings/:id` | One published listing |
| GET | `/api/auth/me` | Current signed-in profile |
| POST | `/api/bookings` | Customer sends booking request |
| GET | `/api/bookings/mine` | Customer's own requests |
| GET | `/api/vendor/listings` | Vendor's own listings |
| POST | `/api/vendor/listings` | Vendor creates listing |
| PATCH | `/api/vendor/listings/:id` | Vendor edits own listing |
| GET | `/api/vendor/bookings` | Vendor's incoming enquiries |
| PATCH | `/api/vendor/bookings/:id/status` | Accept/decline pending enquiry |

## Deploy
This project is a single Express app that serves the frontend and API together.
- Render: create a **Web Service**, connect the repository, Build Command `npm install`, Start Command `npm start`, add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `NODE_ENV=production` environment variables.
- Railway or another Node host: use `npm install` and `npm start`, and add the same environment variables.
- Add your deployed URL to Supabase Auth → URL Configuration → Site URL and Redirect URLs.
- Use HTTPS in production.

## Important limitations before a real commercial launch
- Booking requests are enquiries, not confirmed reservations. There is no live availability calendar, payment capture, refund handling, vendor verification, email/SMS notification, admin moderation or dispute workflow yet.
- Vendors can publish listings, so add a verification/moderation process before opening registration to the public.
- The app currently uses an anon key with RLS and verifies the user's access token. Keep RLS enabled. Do not expose a service-role key.
- Add rate limiting, stronger validation, audit logging, automated tests, image upload/storage rules, backups and privacy/terms pages before production use.
- Do not use real customer data until you have reviewed privacy, consent and retention requirements.

## Project structure
```text
vivaahhub-milestone-2/
  public/
    index.html
    styles.css
    app.js
  src/
    middleware/auth.js
    routes/auth.js
    routes/listings.js
    routes/bookings.js
    routes/vendor.js
    supabase.js
    server.js
  supabase/schema.sql
  .env.example
  package.json
  README.md
```
