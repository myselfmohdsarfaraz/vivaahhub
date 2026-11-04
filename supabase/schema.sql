-- VivaahHub database schema
-- Run this entire file in Supabase Dashboard -> SQL Editor.
-- Uses Supabase Auth; passwords are managed by Supabase, never stored in these tables.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role text not null default 'customer' check (role in ('customer', 'vendor')),
  created_at timestamptz not null default now()
);

create table if not exists public.listings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  category text not null check (category in ('venue','catering','photography','decor','makeup','planning','other')),
  city text not null,
  description text not null,
  starting_price numeric(12,2) not null default 0 check (starting_price >= 0),
  max_guests integer not null default 0 check (max_guests >= 0),
  image_url text,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  vendor_id uuid not null references public.profiles(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  event_date date not null,
  guest_count integer not null check (guest_count > 0),
  message text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now()
);

create index if not exists listings_published_category_city_idx on public.listings(is_published, category, city);
create index if not exists listings_vendor_id_idx on public.listings(vendor_id);
create index if not exists bookings_customer_id_idx on public.bookings(customer_id);
create index if not exists bookings_vendor_id_idx on public.bookings(vendor_id);

-- Create a profile automatically when a new user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_user_meta_data ->> 'role' = 'vendor' then 'vendor' else 'customer' end
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.listings enable row level security;
alter table public.bookings enable row level security;

-- Profiles: users can see and update only their own profile.
drop policy if exists "profile_select_own" on public.profiles;
create policy "profile_select_own" on public.profiles for select to authenticated using (id = (select auth.uid()));
drop policy if exists "profile_update_own" on public.profiles;
create policy "profile_update_own" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Public can discover published listings. Vendors can also see their own drafts.
drop policy if exists "listings_public_read" on public.listings;
create policy "listings_public_read" on public.listings for select to anon, authenticated
using (is_published = true or vendor_id = (select auth.uid()));
drop policy if exists "listings_vendor_insert" on public.listings;
create policy "listings_vendor_insert" on public.listings for insert to authenticated
with check (vendor_id = (select auth.uid()) and exists (
  select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'vendor'
));
drop policy if exists "listings_vendor_update" on public.listings;
create policy "listings_vendor_update" on public.listings for update to authenticated
using (vendor_id = (select auth.uid())) with check (vendor_id = (select auth.uid()));
drop policy if exists "listings_vendor_delete" on public.listings;
create policy "listings_vendor_delete" on public.listings for delete to authenticated
using (vendor_id = (select auth.uid()));

-- A customer creates and reads their own booking requests.
drop policy if exists "booking_customer_insert" on public.bookings;
create policy "booking_customer_insert" on public.bookings for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and status = 'pending'
  and exists (select 1 from public.listings l where l.id = listing_id and l.vendor_id = vendor_id and l.is_published = true)
);
drop policy if exists "booking_customer_read" on public.bookings;
create policy "booking_customer_read" on public.bookings for select to authenticated
using (customer_id = (select auth.uid()));

-- Vendors can read enquiries sent to them and update only pending status.
drop policy if exists "booking_vendor_read" on public.bookings;
create policy "booking_vendor_read" on public.bookings for select to authenticated
using (vendor_id = (select auth.uid()));
drop policy if exists "booking_vendor_update" on public.bookings;
create policy "booking_vendor_update" on public.bookings for update to authenticated
using (vendor_id = (select auth.uid()) and status = 'pending')
with check (vendor_id = (select auth.uid()) and status in ('accepted','rejected'));


-- Prevent a vendor from changing the customer, listing, event details or message
-- while responding to an enquiry. Only pending -> accepted/rejected is allowed.
create or replace function public.guard_booking_vendor_update()
returns trigger
language plpgsql
as $$
begin
  if new.listing_id is distinct from old.listing_id
     or new.vendor_id is distinct from old.vendor_id
     or new.customer_id is distinct from old.customer_id
     or new.event_date is distinct from old.event_date
     or new.guest_count is distinct from old.guest_count
     or new.message is distinct from old.message
     or new.created_at is distinct from old.created_at then
    raise exception 'Booking details cannot be changed after submission';
  end if;
  if old.status <> 'pending' or new.status not in ('accepted', 'rejected') then
    raise exception 'Only pending enquiries can be accepted or rejected';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_booking_vendor_update_trigger on public.bookings;
create trigger guard_booking_vendor_update_trigger
before update on public.bookings
for each row execute procedure public.guard_booking_vendor_update();
