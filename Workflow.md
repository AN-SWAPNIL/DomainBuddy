# Domain Buying Agent — End-to-End Flow (Design Blueprint)

Below is a concise, production-minded blueprint you can hand to a full-stack team. It covers user journeys, backend sequences, data model, integrations (Namecheap sandbox, Stripe Test Mode, Supabase), simulated DNS, optional Cloudflare DNS, pricing/expiry logic, and admin controls.

---

## 1) System Architecture (MVP)

**Frontend:** Next.js/React (TypeScript), app router, server actions
**Auth & DB:** Supabase (Auth, Postgres, Storage, Edge Functions/CRON)
**Payments:** Stripe (Test Mode only)
**Registrar:** Namecheap Sandbox (search, price), adapter-ready for more registrars later
**DNS:** Simulated in DB (MVP) + optional Cloudflare API (real edits if domain delegated)
**Email:** Supabase + your SMTP (for receipts and expiry notices)
**PDF Receipts:** Server-side PDF generation, store in Supabase Storage

---

## 2) Core User Journeys (Happy Paths)

### A) Search & Compare → Add to Cart

1. User enters a name: `mybrand` and selects TLDs (`.com`, `.net`, `.org`, …).
2. Frontend calls **Search API** → Aggregator queries Namecheap sandbox (and any other enabled registrar adapters).
3. Response shows:

   * Availability per TLD (true/false + reason if unavailable)
   * Base registrar price(s) (registration/renewal when available)
   * Your **final price** = base × (1 + markup%) + fees (configurable)
4. User picks one or more registrar options → **Add to Cart** (cart item keeps a price snapshot).

### B) Checkout → Payment Simulation → “Ownership”

1. User opens Cart → clicks **Checkout**.
2. Backend creates a **Stripe PaymentIntent** (test mode), amount = cart total.
3. On client success, a **server webhook** (or server action) marks the **Order** `paid_test`.
4. System “allocates” the domain to the user (simulated) by creating `user_domains` row with `status='active'` and `expires_at = now() + 1 year`.
5. Generate **PDF receipt**, email user, store in Supabase Storage.

### C) Manage DNS (Simulated) & Subdomains

1. In **Portfolio**, user selects a domain → **DNS panel**.
2. CRUD DNS records (A/AAAA/CNAME/TXT/MX/SRV/CAA) in `dns_records` table.
3. Create **subdomains** by adding new records (e.g., `blog.mybrand.com` → CNAME).
4. (Optional **real DNS** mode) If using Cloudflare and nameservers delegated, mirror record CRUD to Cloudflare via API.

### D) Renewals / Expiry

1. **Background job** checks `expires_at` nightly (Asia/Dhaka timezone) and emails 30/7/1 days before expiry.
2. If not renewed by `expires_at`, mark `status='expired'` (simulated).

---

## 3) High-Level Sequence Diagrams

### Search → Compare → Cart

```
UI ──(query: name+tlds)──> Search API
Search API ──> NamecheapAdapter (sandbox)
Search API <── availability+prices
Search API ── calculate markup ──> UI
UI ── Add to Cart ─> Cart API (persist snapshot)
```

### Checkout (Test Payment)

```
UI ── checkout ─> Orders API
Orders API ── create PaymentIntent ─> Stripe (test)
UI ── confirm card (test) ─> Stripe
Stripe ── webhook (succeeded) ─> Orders API
Orders API ──> create user_domains (active, expires_at)
Orders API ──> generate PDF receipt + email + store
UI <── order confirmed
```

### DNS CRUD (Simulated; optional Cloudflare sync)

```
UI ── create/patch/delete record ─> DNS API
DNS API ── upsert in dns_records ─> DB
[if cloudflare_enabled] DNS API ── mirror ─> Cloudflare API
UI <── success
```

---

## 4) API Surface (suggested)

**Auth:** Supabase Auth (email/password, OAuth).
**Headers:** Use Supabase access token (RLS enforced).

**Search/Price**

* `POST /api/search`

  * body: `{ "query":"mybrand", "tlds":["com","net","org"], "registrars":["namecheap"] }`
  * resp: array of `{ registrar, tld, available, basePrice, renewalPrice?, currency, finalPrice, reason? }`

**Cart**

* `POST /api/cart/items` → `{ domain:"mybrand", tld:"com", registrar:"namecheap", priceSnapshot:{...} }`
* `GET /api/cart` → user cart with items + totals
* `DELETE /api/cart/items/:id`

**Orders & Payment**

* `POST /api/orders` → creates order from current cart, returns Stripe client secret
* `POST /api/stripe/webhook` → handles `payment_intent.succeeded` (test)
* `GET /api/orders/:id` → order details + receipt link
* `POST /api/orders/:id/renew` → create renewal PI (test) and on success extend `expires_at` +1y

**Portfolio**

* `GET /api/me/domains` → list of user-owned (sim) domains + expiry
* `GET /api/me/domains/:id` → detail + DNS summary

**DNS (Simulated)**

* `GET /api/me/domains/:id/dns`
* `POST /api/me/domains/:id/dns` → create record
* `PATCH /api/me/domains/:id/dns/:recordId`
* `DELETE /api/me/domains/:id/dns/:recordId`

**Admin**

* `GET/PUT /api/admin/pricing` → `{ defaultMarginPct, perTldOverrides: { "com":0.15,"io":0.20 } }`
* `GET/PUT /api/admin/registrars` → enable/disable adapters, credentials
* `GET /api/admin/orders` / `/users` (RBAC: admin only)

---

## 5) Data Model (Supabase/Postgres)

```sql
-- Users: Supabase Auth manages identities

create table pricing_rules (
  id bigint primary key generated always as identity,
  default_margin_pct numeric not null default 0.15,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table pricing_overrides (
  id bigint primary key generated always as identity,
  tld text not null,
  registrar text not null,            -- e.g., 'namecheap'
  margin_pct numeric not null,
  unique(tld, registrar)
);

create table carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  status text not null default 'open' -- open|locked|abandoned
);

create table cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid references carts(id) on delete cascade,
  domain text not null,               -- 'mybrand'
  tld text not null,                  -- 'com'
  registrar text not null,            -- 'namecheap'
  available boolean not null,
  currency text not null default 'USD',
  base_price numeric not null,
  final_price numeric not null,       -- after markup+fees at time of add
  price_snapshot jsonb not null,      -- store raw pricing for audit
  created_at timestamptz default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  cart_id uuid references carts(id),
  status text not null,               -- created|paid_test|failed|refunded
  currency text not null default 'USD',
  subtotal numeric not null,
  fees numeric not null default 0,
  total numeric not null,
  stripe_payment_intent text,
  receipt_url text,                   -- Supabase Storage public URL
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  domain text not null,
  tld text not null,
  registrar text not null,
  final_price numeric not null
);

create table user_domains (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  domain text not null,               -- 'mybrand.com'
  registrar text not null,
  order_id uuid references orders(id),
  status text not null,               -- active|expired|pending|failed
  purchased_at timestamptz default now(),
  expires_at timestamptz not null,
  auto_renew boolean default false
);

create table dns_records (
  id uuid primary key default gen_random_uuid(),
  user_domain_id uuid references user_domains(id) on delete cascade,
  type text not null,                 -- A|AAAA|CNAME|TXT|MX|CAA|SRV
  name text not null,                 -- 'mybrand.com' or 'blog.mybrand.com'
  value text not null,                -- '203.0.113.10' or 'target.domain.'
  ttl int not null default 300,
  priority int,                       -- for MX/SRV
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table registrar_accounts (
  id bigint primary key generated always as identity,
  registrar text not null,            -- 'namecheap'
  enabled boolean not null default true,
  creds jsonb not null                -- sandbox keys, etc.
);

create table audit_logs (
  id bigint primary key generated always as identity,
  user_id uuid,
  action text not null,
  meta jsonb,
  created_at timestamptz default now()
);
```

**Row Level Security (RLS):**

* `carts`, `cart_items`, `orders`, `order_items`, `user_domains`, `dns_records` visible only to `user_id`.
* Admin endpoints gated with Supabase **roles/claims** check (e.g., JWT `role=admin`).

---

## 6) Registrar Aggregation & Pricing

**Adapter Interface (server):**

```ts
interface RegistrarAdapter {
  name: 'namecheap' | 'porkbun' | '...';
  checkAvailability(input: { sld: string; tlds: string[] }): Promise<Array<{
    tld: string;
    available: boolean;
    basePrice: number;     // 1st-year register
    renewalPrice?: number;
    currency: string;
    reason?: string;       // e.g., premium, reserved
  }>>;
}
```

**Pricing Pipeline:**

```
finalPrice = roundToCent(
  applyPerTldOverride(basePrice, registrar, tld) ??
  basePrice * (1 + default_margin_pct)
  + platform_fees (optional)
)
```

**Caching:**

* Cache availability/price per (sld,tld,registrar) for 60–300s (in-memory + Redis if needed).
* Debounce user input; do batched requests.

**Edge Cases:**

* Premium/reserved names → show `reason`, disable add-to-cart.
* Sandbox sometimes returns mismatches → always persist a **price snapshot** in `cart_items` to avoid surprises.

---

## 7) Payment Simulation (Stripe Test)

**Create order:**

* Lock cart → compute totals from `cart_items`.
* `POST /api/orders` returns `client_secret`.

**Confirm on client:** Use test card `4242 4242 4242 4242`.

**Webhook (`/api/stripe/webhook`):**

* On `payment_intent.succeeded`:

  * Mark `orders.status='paid_test'`.
  * Create `order_items` (from snapshot).
  * For each item, upsert `user_domains` with `status='active'`, `expires_at = now() + interval '1 year'`.
  * Generate & store **PDF receipt** → attach to order.
  * Send confirmation email.

---

## 8) DNS Management (Simulated + Optional Real)

**Simulated:**

* CRUD in `dns_records` only. Render records in UI.
* Validate inputs (record type constraints; CNAME cannot coexist with same-name A/AAAA, etc.).
* Subdomains are just records where `name='blog.mybrand.com'`.

**Optional Real (Cloudflare):**

* Store Cloudflare zone info per `user_domain` (after manual delegation to CF).
* On record CRUD, call Cloudflare API; persist the mirror row in `dns_records`.
* Graceful fallback: if CF fails, keep local state and show warning.

---

## 9) Expiry & Renewal

**Policy:**

* Default one-year term (simulated).
* `auto_renew` flag (if true, kick off test payment 7 days before expiry).

**CRON (Supabase Edge Function, timezone: Asia/Dhaka):**

* Daily at 03:00 BD time:

  * Email reminders at D-30, D-7, D-1.
  * On D-0 without renewal, mark `expired`.

**Manual Renew:**

* Button in Portfolio → creates renewal order (test) → on success extend `expires_at` by +1y.

---

## 10) Domain Suggestions (MVP)

* On typing `mybrand`, generate:

  * **Affixes:** `get`, `try`, `use`, `app`, `hq`, `labs`, `shop`.
  * **Plurals/typos:** distance-1 edits (Damerau-Levenshtein) for short names.
  * **Semantic:** simple synonym list for common words (small static map).
* Batch recheck availability for top N candidates.

---

## 11) Admin Panel

* **Pricing:** Set default markup %, per-TLD override, fees/taxes toggles.
* **Registrars:** Enable/disable adapters; edit sandbox creds.
* **Orders:** Filter by status; view receipts.
* **Users:** View portfolios (read-only).
* **Flags:** Cloudflare enabled? WHOIS panel enabled? Currency.

RBAC: Only `role=admin` JWT sees admin routes.

---

## 12) Observability & Security

* **Logging/Audit:** All state changes → `audit_logs`.
* **Metrics:** Search latency per adapter, webhook success rate, refund/void events (if you add later).
* **Secrets:** Store registrar/Stripe keys in server env, not client.
* **RLS:** Strict checks; never trust client-side user IDs.

---

## 13) Testing Matrix

* **Unit:** Pricing calc, adapters, DNS validators.
* **Integration:** Search end-to-end (debounce, cache), checkout, webhook idempotency, receipt generation.
* **E2E (Playwright):** Search → compare → cart → test pay → portfolio → DNS CRUD → renew → expire.
* **Edge Cases:** Premium names, TLD unsupported, webhook retries, abandoned carts, partial adapter outage.

---

## 14) Deliverables Mapping

* **Clean, reusable code:** Adapter pattern for registrars; typed DTOs; feature-scoped modules.
* **Domain search UI with suggestions:** Debounced input, batched TLD checks, suggestion chips.
* **Cart & checkout:** Price snapshots, tax/fee lines, Stripe test.
* **Payment simulation:** Test cards, receipts (PDF), email.
* **User dashboard (portfolio):** Domains, expiry, renew, DNS panel.
* **DNS panel:** Record table + guided forms; subdomain quick-add.
* **Admin panel:** Pricing configuration, registrar toggles, order/user browsers.

---

## 15) Minimal Implementation Checklist

* [ ] Supabase project with Auth, tables, RLS policies
* [ ] Environment vars: `STRIPE_SECRET_KEY`, `NAMECHEAP_API_KEY/USER/IP`, `CF_API_TOKEN` (optional)
* [ ] Registrar **NamecheapAdapter** (sandbox) implemented
* [ ] Search API + caching, pricing pipeline, suggestions
* [ ] Cart, Orders, Stripe Test, webhook with idempotency key
* [ ] PDF receipts + Storage + emailer
* [ ] Portfolio + DNS CRUD (validate types, TTL, conflicts)
* [ ] Expiry cron & reminder emails (BD time)
* [ ] Admin UI for pricing and registrars
* [ ] E2E tests for the main flows

---

If you want, I can draft the **exact SQL for RLS policies**, a **TypeScript adapter scaffold** for Namecheap, and **Next.js API route stubs** matching this flow.
