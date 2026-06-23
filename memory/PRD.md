# ToolShare — Product Requirements Document (PRD)

> **Original problem statement**: Design a scalable SaaS platform called "ToolShare" for North America that enables people to rent tools locally from other community members. Tool owners can list tools for rent. Renters discover nearby tools via location. The platform focuses on tool rentals and community sharing. Future versions will support buying and selling tools.

## 1. Vision & North-Star
A trusted local marketplace where neighbours rent tools to each other — turning idle garages into income and saving renters from one-time tool purchases. Differentiated by a built-in **AI Tool Assistant** that maps natural-language project descriptions to the exact tools needed and nearby listings.

## 2. Target Users (Personas)
| Persona | Goals | Pain points |
|---|---|---|
| **Casual DIYer** (Sara, 32) | Finish weekend projects without buying $300 tools | Doesn't know what tools she needs; storage cost |
| **Tool Owner** (Marcus, 45) | Earn passive income from tools sitting in garage | Worries about damage, no payment platform |
| **Pro Contractor** (Diego, 38) | Source specialty gear on demand | Rental shops are far, expensive, limited inventory |

## 3. Core Requirements (MVP — implemented)
- **User Management** — Email/password (JWT) + Emergent-managed Google OAuth, profiles, verification badge
- **Tool Listings** — Images (object storage), title, description, 13 categories, daily price, security deposit, condition, location (lat/lng), pickup/delivery, availability
- **Discovery** — Map+list split view (Leaflet/OSM), category filters, price slider, city/postal search, radius filtering, sort by distance
- **AI Tool Assistant** — Natural-language task → structured tool recommendations → matched against nearby listings (OpenAI GPT-4o-mini via Emergent Universal Key)
- **Booking System** — Date-range bookings, owner approval/decline, status tracking (pending → approved → completed)
- **Favorites** — Save tools to user account
- **Reviews** — Bidirectional reviews (renter ↔ owner) + tool condition rating; aggregate ratings on profile & listing
- **Public Profile** — User page with listings and reviews

## 4. Deferred (P1 / P2)
- **P1**: Stripe Connect + PayPal payments and automatic payouts, in-app messaging, push/email notifications, identity verification (ID upload), admin dashboard, dispute handling
- **P2**: Multi-language (EN/FR/ES), Apple OAuth, buying & selling tools, insurance/protection plans, mobile apps (iOS/Android)

## 5. Database Schema (MongoDB Collections)

### users
```
{ id, email (unique), password_hash (nullable for OAuth), name, picture, bio, city, auth_provider, rating_avg, rating_count, is_verified, created_at }
```

### tools
```
{ id, owner_id, title, description, category, daily_price, security_deposit, condition, images[],
  location: {address, city, state, postal_code, lat, lng},
  pickup_available, delivery_available, delivery_radius_km, unavailable_dates[],
  quantity_total (int, default 1 — number of identical units in stock),
  price_currency, listing_type, sale_price, is_featured,
  is_available, view_count, rating_avg, rating_count, created_at }
```

### bookings
```
{ id, tool_id, renter_id, owner_id, start_date, end_date,
  quantity (int, default 1),
  total_price, deposit, rental_price, insurance_tier, insurance_fee,
  status, pickup_method, delivery_address, message_to_owner,
  paid, created_at, updated_at }
```

### reviews
```
{ id, booking_id, tool_id, reviewer_id, target_user_id, target_type, rating, comment, created_at }
```

### favorites
```
{ id, user_id, tool_id, created_at }
```

### sessions (Google OAuth)
```
{ session_token, user_id, expires_at, created_at }
```

### files (storage references)
```
{ id, storage_path, owner_id, original_filename, content_type, size, is_deleted, created_at }
```

## 6. API Architecture (`/api` prefix)
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth/register` | Email/pw signup |
| POST | `/auth/login` | Email/pw login |
| POST | `/auth/google/session` | Exchange Emergent session_id |
| GET | `/auth/me` | Current user |
| POST | `/auth/logout` | End session |
| PUT | `/auth/profile` | Update profile |
| GET | `/categories` | Tool categories |
| GET | `/tools` | List/filter tools |
| POST | `/tools` | Create tool (auth) |
| GET | `/tools/:id` | Tool detail |
| PUT/DELETE | `/tools/:id` | Manage tool (owner) |
| GET | `/my/tools` | Owner's listings |
| POST | `/upload` | Upload image (auth) |
| GET | `/files/:path` | Serve image |
| POST | `/bookings` | Create booking |
| GET | `/bookings?role=renter\|owner` | List bookings |
| GET | `/bookings/:id` | Booking detail |
| PUT | `/bookings/:id/status` | Approve/decline/cancel/complete |
| POST | `/favorites/:tool_id` | Save |
| DELETE | `/favorites/:tool_id` | Unsave |
| GET | `/favorites` | List user's saved tools |
| POST | `/reviews` | Create review |
| GET | `/reviews?tool_id=&user_id=` | List reviews |
| GET | `/users/:id` | Public profile |
| POST | `/ai/recommend` | AI tool assistant |

## 7. Monetization Strategy
- **Service fee** (planned) — 8–15% per rental, charged to renter at booking
- **Owner payout** — 85–92% via Stripe Connect Express accounts (P1)
- **Featured listings** (P1) — owners pay to promote in search results / map
- **Insurance / Damage protection** (P2) — opt-in plan, ToolShare takes margin
- **Subscription for power lenders** (P2) — fee-free listings + analytics

## 8. Security & Trust
- bcrypt password hashing, JWT (HS256, 30-day expiry)
- Per-route ownership checks on tools/bookings
- Server-side session validation for Google OAuth (Emergent endpoint)
- Object storage paths are app-prefixed and DB-validated before serving
- HTTPS-only via Cloudflare ingress
- Future: identity verification (gov ID upload), fraud signals, dispute escalation

## 9. Deployment Architecture
**Current (MVP)**:
- FastAPI backend (uvicorn) on port 8001
- React (CRA + craco) frontend on port 3000
- MongoDB (Motor async client)
- Emergent Object Storage for images
- Emergent Universal LLM Key → OpenAI GPT-4o-mini
- Single-container preview via Kubernetes ingress

**Production target** (when scaling):
- Backend: containerised on AWS ECS Fargate, ALB, multi-AZ
- DB: MongoDB Atlas M30+ with replica set
- Cache: Redis (ElastiCache) for category/feed caching
- Images: Cloudflare R2 or S3 with CDN
- Search: Atlas Search (text index on tools)
- Edge: Cloudflare for static + WAF

## 10. Future Expansion
- Tool buying/selling (extends `tools` with `for_sale` flag, `sale_price`)
- Multi-language (i18n with English/French/Spanish)
- Native mobile apps (React Native sharing API layer)
- ToolShare Pro: contractor/business accounts with invoicing
- Community projects: borrow groups, neighbourhood tool libraries

## 11. Roadmap & Timeline (suggested for prod build-out)
| Sprint | Weeks | Scope |
|---|---|---|
| MVP (done) | 1 | Auth, listings, search, AI, bookings, reviews, favorites |
| Payments | 2–3 | Stripe Connect + PayPal, payout pipeline |
| Trust | 4 | ID verification, messaging, notifications (Resend/Twilio) |
| Admin | 5 | Admin dashboard, dispute UI, analytics |
| i18n | 6 | EN/FR/ES with react-i18next |
| Scale | 7+ | Search, caching, mobile apps |

## 12. Status of MVP Build (2026-06-08)
- ✅ Backend API (28 endpoints) on FastAPI
- ✅ React frontend with 9 routes (Landing, Browse, Tool Detail, List, Dashboard, Login, Register, Profile, AI, Booking Detail)
- ✅ Map-based discovery (Leaflet + OpenStreetMap)
- ✅ AI Tool Assistant returning structured recommendations
- ✅ Seeded 3 users + 12 tools in Toronto/Mississauga for demo
- ✅ Design system: warm bone-white + forest green + terracotta, Manrope/DM Sans

## 12b. P1 Build (2026-06-08)
- ✅ **Anti-double-booking guard** — overlap detection at booking creation AND approval (HTTP 409)
- ✅ **Stripe Checkout** for renter payments via `emergentintegrations` helper (10% platform fee tracked per booking)
- ✅ **Stripe Identity** for ID verification with selfie matching (`is_verified=true` on success)
- ✅ **In-app messaging** with thread list + polling (5–8s); inline panel on booking detail
- ✅ **Admin dashboard** at `/admin` — stats, users (verify/admin/suspend toggles), bookings (dispute toggle), tools, email log
- ⚠️ **Email notifications** — MOCKED: writes to `db.email_log`. Provide Resend API key to enable real sending.
- ✅ Tests: 43/43 backend pytest, frontend flows verified

## 12c. i18n Build (2026-06-09)
- ✅ **Multi-language EN/FR/ES** via `react-i18next` + `i18next-browser-languagedetector`
- ✅ `LanguageSwitcher` dropdown in header (🇨🇦 English / 🇫🇷 Français / 🇪🇸 Español)
- ✅ Language persisted in localStorage `toolshare_lang`
- ✅ All key pages translated (Landing, Header/Footer, Browse, ToolDetail, ListTool, Login, Register, Dashboard, AIAssistant, BookingDetail, Messages, Profile, Admin, ToolCard)
- ✅ AI Assistant example chips adapt to current language; category labels translated
- ✅ Tests: 100% frontend i18n pass on EN/FR/ES across 7 key pages

## 12d. Buy/Sell + Insurance + Featured (2026-06-09)
- ✅ Tools have `listing_type` (rent/sell/both) + `sale_price`; "FOR SALE" pill in card
- ✅ `/api/purchases` POST (?tool_id) + GET (role=buyer|owner); tool marked `is_sold` after purchase
- ✅ Insurance tiers (none/basic/premium) at `/api/insurance/tiers`; daily fee added to booking total
- ✅ `is_featured` on tools; admin toggle via `PUT /api/admin/tools/{id}/feature`; Browse sorts featured-first with FEATURED badge
- ✅ Persisted Browse filters (radius_km, max_price, listing_type) in `localStorage`

## 12e. Favorites + Reviews enhancements (2026-06-09)
- ✅ Favorites: tools (existing) + **availability alerts** (`alerts_on` flag) + **owner follows** (`owner_follows` collection)
- ✅ Endpoints: `POST/DELETE /api/follows/{owner_id}`, `GET /api/follows`, `GET /api/follows/check/{id}`; `POST /api/favorites/{tool_id}?alerts=bool`
- ✅ Follower notify hook on new tool creation; availability-alert hook on booking complete/cancelled (MOCKED email_log)
- ✅ Profile page Follow / Following button; Dashboard Favorites tab has "Saved tools" (bell-alert + X-remove) + "Followed owners" (unfollow)
- ✅ Reviews: optional `condition_tag` (like_new/good/fair/poor) on tool reviews; `hidden` flag for moderation
- ✅ Admin: `/api/admin/reviews` list + `PUT /api/admin/reviews/{id}/hide` toggle; Reviews tab on Admin page with hide/unhide
- ✅ Tests: 14/14 backend pytest (iteration_7); all UI flows verified across EN/FR/ES

## 12f. Review dedupe (2026-06-09)
- ✅ Backend: unique index on `db.reviews` (booking_id, reviewer_id, target_type); explicit pre-insert check returning 409 with friendly message
- ✅ Frontend BookingDetail: fetches existing reviews on mount; hides submit buttons for already-reviewed targets; shows "Already submitted: …" hint; locks button on 409 (defense in depth)
- ✅ i18n: `booking.review_already` in EN/FR/ES
- ✅ Verified live: 1st = 200, 2nd same target = 409, different target = 200

## 12g. TypeScript migration — pragmatic hybrid (2026-06-09)
- ✅ tsconfig.json (`allowJs: true`, `strict: false`, `paths: { "@/*": ["*"] }`, `jsx: "react-jsx"`)
- ✅ `src/types/index.ts` — central domain types (User/AuthUser/Tool/Booking/Review/Purchase/Message/InsuranceTiers/AdminStats etc.)
- ✅ `src/globals.d.ts` — ambient process.env + module shims for remaining .jsx pages
- ✅ Fully typed core: `lib/api.ts`, `lib/auth.tsx`, `lib/dateFormat.ts`, `App.tsx`
- ✅ Fully typed page: `pages/Browse.tsx` (consumes `Tool`, `ListingType` from `@/types`)
- ✅ Fully typed shadcn primitives: `components/ui/button.tsx`, `components/ui/input.tsx`
- ✅ Other pages remain `.jsx` and compile via `allowJs` — gradual migration path preserved
- ✅ Tests: iter8 — frontend 100% (all 5 public routes + auth + 4 dashboard tabs + Browse filters/view modes + ToolDetail buy + Admin 5 tabs + EN/FR/ES translations); backend 19/19 (iter7 + iter8 regression)

## 12h. Map-centered search + TS hot-page migration (2026-06-09)
- ✅ **Map-driven search**: Browse map auto-recenters search when user pans/zooms (Leaflet `dragstart`/`zoomstart` detection + 350ms debounce); programmatic moves swallowed via `programmaticMoveRef`. Viewport-derived radius applied only when user hasn't explicitly set the slider (respects user filter).
- ✅ Hint pill (`data-testid="map-search-hint"`) shows "Showing tools in this map area · Use my location" once user pans; recenter button (`data-testid="map-recenter-btn"`) restores device geolocation as search center.
- ✅ Empty-state in map view shown as overlay (`data-testid="browse-empty-overlay"`) keeping the map + hint mounted; split view shows "No tools in this area" in the list pane with a recenter CTA. Loading state in map views uses a small pill instead of unmounting the map.
- ✅ i18n: `browse.no_tools_in_area`, `browse.no_tools_in_area_hint` in EN/FR/ES.
- ✅ **TS migration P2**: `Profile`, `BookingDetail`, `Admin`, `Dashboard`, `ToolDetail`, `MapView` all converted to `.tsx`. Shadcn primitives also typed: `avatar`, `badge`, `button`, `calendar`, `input`, `label`, `radio-group`, `select`, `slider`, `switch`, `tabs`, `textarea`.
- ✅ `tsc --noEmit` reports 0 errors. (fork-ts-checker may surface stale contextual-typing warnings during dev hot-reload; `TSC_COMPILE_ON_ERROR=true` in `.env` keeps the dev server unblocked.)
- ✅ Verified live: keyboard-pan → 2 new API calls with new lat/lng/radius_km → hint visible → recenter click hides hint and restores Toronto-centered tool list.

## 12i. Currency switcher + full TS coverage (2026-06-09)
- ✅ **6-currency support** (USD/CAD/EUR/GBP/MXN/AUD) via typed `CurrencyProvider` in `lib/currency.tsx`
- ✅ **Geo-IP defaulting** on first visit via `ipapi.co/json/` → `country_code → currency`; persisted in `localStorage` `toolshare_currency`. Falls back to USD silently if fetch blocked.
- ✅ Switcher dropdown (`data-testid="currency-switcher"`) in Header next to LanguageSwitcher; spinner during detection; per-currency items `data-testid="currency-XXX"`.
- ✅ `useCurrency().format(price)` used by ToolCard for rental + sale prices; backend `/api/fx/rates` extended to all 6 currencies (USD-base, cached 1h).
- ✅ **Full TS coverage**: every page (`Landing`, `ListTool`, `Login`, `Register`, `AIAssistant`, `Messages`) and component (`Header`, `Footer`, `ToolCard`, `LanguageSwitcher`, `CurrencySwitcher`) now `.tsx`.
- ✅ Catch-all `*` route → `NotFound` keeps Header (and currency switcher) mounted on unknown paths.
- ✅ Tests: iter11 — backend FX rates 5/5; frontend currency switching, persistence, EUR conversion ($12 → 11 €), TS regression across all routes, map-search regression all pass.

## 12j. Full currency formatting (2026-06-09)
- ✅ Hard-coded `$` price displays replaced with `useCurrency().format()` across:
  - **ToolDetail**: header daily-price, deposit, insurance daily-fee, rental subtotal, insurance subtotal, grand total, sale-price, purchase confirm dialog
  - **BookingDetail**: header total + deposit, summary rental row + deposit row, grand total
  - **Admin**: revenue stat card, owed/pending payouts (via i18n placeholder), bookings table total, tools table daily price
  - **Dashboard**: BookingRow total
  - **AIAssistant**: recommended-tool inline price
  - **MapView**: marker pin label + popup daily price
- ✅ i18n fix: removed hard-coded `$` prefix from `tool.deposit_refundable` and `admin.owed` in EN/FR/ES; values now pre-formatted via `format()` before being passed to `t()`.
- ✅ Verified live: EUR mode shows "11 € / day · + 37 € refundable deposit · +7 €/day · +18 €/day" with zero hard-coded `$` price fields anywhere. (Insurance tier labels like "$1,000 coverage" remain — those are coverage caps, not display prices.)

## 12k. Per-listing local pricing + AI quota (2026-06-09)
- ✅ **Per-listing currency**: `tools.price_currency` field (default "USD") on backend. ListTool form has a currency dropdown (data-testid `price-currency-select`) defaulting to the viewer's currency. CURRENCIES list shared from `lib/currency.tsx`.
- ✅ **On-the-fly conversion**: `useCurrency().format(amount, { from: tool.price_currency })` extended to handle source ≠ display. Browse, ToolCard, ToolDetail, MapView pins/popups all pass `from: tool.price_currency`. Conversion goes amount → USD → target currency via the cached rates table.
- ✅ **Currency-aware price filter**: GET `/api/tools` accepts `viewer_currency` param; when paired with `max_price`/`min_price` it filters in Python by converting each listing's price to viewer currency. Verified: `max_price=15&viewer_currency=EUR` matches a $12 listing (~11 €), `max_price=10&viewer_currency=USD` matches 0 listings.
- ✅ **AI rate limit**: `db.ai_usage` collection + rolling 24h window. Anonymous = 401 (must sign in). Logged-in = 15/24h. Admin = unlimited. GET `/api/ai/quota` returns counter; POST `/api/ai/recommend` returns 429 with `{message, remaining, total}` when exceeded and includes `quota` in success response.
- ✅ **AIAssistant UI**: counter pill `15 / 15 AI requests left (24h)` (data-testid `ai-quota-counter`); login gate (`ai-login-gate`) for anonymous; quota error banner (`ai-quota-error`) on 429; input/submit disabled when remaining=0; unlimited badge for admin.
- ✅ i18n keys added (EN/FR/ES): `ai.quota_label`, `ai.quota_exceeded`, `ai.unlimited`, `ai.login_required_title/body`, `ai.sign_in_cta`, `list_tool.currency_label`, `list_tool.currency_hint`.
- ✅ Verified live: anonymous shows login gate; logged-in shows 15/15 counter; backend quota endpoint returns correct counts; currency filter math correct.

## 12l. Multi-region demo seed (2026-06-09)
- ✅ `seed_demo.py` now creates **7 demo users across 6 cities** (Toronto, Mississauga, New York, London, Paris, Mexico City) and **17 demo tools spanning 5 currencies** (CAD, USD, EUR, GBP, MXN).
- ✅ Each tool stamped with `price_currency` based on its city via the new `CITY_CURRENCY` map. Owners are city-matched so tools cluster naturally near their owner.
- ✅ Localized titles for non-English cities (Échafaudage Pliant 2m, Taladro Inalámbrico DeWalt, Pulidora Bosch).
- ✅ Verified live: in EUR view the Browse grid renders 19 cards with prices like "11 €/day (Toronto)", "13 €/day (Mexico City)", "7 €/day + 175 € to buy (London)" — cross-currency conversion working transparently.
- ✅ Cleaned up 6 stale `TEST_iter*` tools from prior test runs.

## 12m. Multi-unit inventory + State/Province filter (2026-02-12)
- ✅ **Multi-unit tool listings**: Tools now carry `quantity_total` (default 1). Owners set max stock on the listing form (`data-testid="quantity-total-input"`). Bookings carry a `quantity` (default 1) that scales total_price, deposit, and insurance fees linearly.
- ✅ **Stock-aware availability**: New backend helpers `_booked_qty_by_date` / `_max_booked_qty_in_range` compute peak concurrent occupancy across the requested range. `POST /api/bookings` and `PUT /api/bookings/:id/status` (approve) both 409 when `peak + qty > quantity_total`, with detail `Not enough units available — X of Y left`.
- ✅ **Calendar UX**: `GET /api/tools/:id/unavailable_dates` now returns `{dates, quantity_total, availability}`. Only fully sold-out days appear in `dates`; partial-stock days are styled with a ring on the calendar. ToolDetail booking card shows a +/− quantity selector clamped to remaining stock for the picked range and a "Sold out for these dates" disabled state.
- ✅ **State / Province filter**: Tool location gains `state` (Ontario, New York, CDMX, Île-de-France, etc.). `GET /api/tools` supports `state=<value>` (case-insensitive prefix). Browse filter bar has new inputs (`data-testid="browse-state-input"`, `browse-postal-input`) alongside city. ListTool form has a matching `state-input`.
- ✅ **Seed update**: `seed_demo.py` adds `CITY_STATE` map, stamps `state` on every demo tool, and gives every 4th tool `quantity_total=5` (Bosch Circular Saw, Pressure Washer 2000 PSI, Festool Plunge Saw, Paint Sprayer HVLP).
- ✅ **BookingDetail**: shows `× N units` badge (`data-testid="booking-quantity-badge"`) when quantity > 1.
- ✅ Tests (iter12): backend pytest 11/11 (booking validation, stock math, sold-out transitions, state filter); frontend E2E 1/1 (login → multi-unit tool → range → qty=2 → /bookings/:id).

## 12n. Backend modular refactor (2026-02-12)
- ✅ **server.py shrunk from ~1500 lines → ~70 lines** — now only wires routers, registers startup hooks, and applies CORS.
- ✅ **New `core.py`**: single shared module for env config, Mongo client (`db`, `mongo_client`), auth deps (`current_user`, `optional_user`), all Pydantic models (User, Tool, Booking, Review, AIRecommendIn, ToolLocation), helpers (`hash_password`/`verify_password`, JWT, `serialize_user`, `haversine_km`, `_days_between`), booking-stock math (`_booked_qty_by_date`, `_max_booked_qty_in_range`), location obfuscation, object-storage helpers, and constants (`CATEGORIES`, `INSURANCE_TIERS`, `SUPPORTED_CURRENCIES`, `_DEFAULT_RATES`, `AI_*`).
- ✅ **`routes/` package** — focused modules, each exposes a `router: APIRouter`:
  - `routes/auth.py` — register, login, Google session, me, logout, profile, upload, files, public user
  - `routes/tools.py` — categories, CRUD, search (with `state` filter + currency-aware price filter), unavailable_dates (with stock + availability map), my/tools
  - `routes/bookings.py` — bookings CRUD + status updates (stock re-check on approve), purchases, insurance/tiers
  - `routes/fx.py` — `/fx/rates` (cached 1h)
  - `routes/social.py` — favorites + follows + reviews
  - `routes/ai.py` — `/ai/quota` + `/ai/recommend` with prompt & quota helper
- ✅ **P1 router** (`p1_features.py`) untouched — still receives `db`, `current_user_dep`, `get_user_by_id` via `build_p1_router(...)`.
- ✅ Regression: all 11 iter12 pytest + 14 cross-feature pytest pass. Manual smoke covers every route group (auth, tools, bookings, favorites, fx, ai, admin/p1, multi-unit booking creation with correct pricing math).
- ✅ Cleaned 5 orphan bookings whose tools had been removed in earlier reseeds (was causing a stale-data test failure unrelated to the refactor).

## 12o. Browse filter declutter (2026-02-12)
- ✅ **Filter bar slimmed to essentials**: Search + Category + Rent/Buy toggle + Filters button + View toggle. Previous "everything inline" layout (8+ controls in one row) replaced.
- ✅ **Secondary filters moved into a `Filters` popover** (`data-testid="browse-filters-popover"`): City, State/Province, ZIP/Postal, Max price slider, Distance slider + "Use my location" button.
- ✅ **Active-filter badge** (`data-testid="browse-active-filter-count"`) on the Filters button shows the count of applied secondary filters.
- ✅ **Active-filter chips** below the toolbar (`data-testid="browse-active-filters"`, `browse-chip-{key}`) — one-click removal of individual filters or all-at-once via "Clear filters" link.
- ✅ Popover-internal "Clear filters" link only resets the popover's filters (city/state/postal/max_price/radius/verified_only), preserving Search/Category/listing-type.
- ✅ Translations added for new keys (`browse.filters`, `browse.filters_location`, `browse.filters_max_price`, `browse.filters_radius`, `browse.any`) in EN/FR/ES.

## 12p. True Identity Verification — self-hosted (2026-02-12)
- ✅ **Replaced Stripe Identity stub** (which failed because pod's `sk_test_emergent` was a placeholder) with a fully self-hosted ID upload + admin manual review flow.
- ✅ **Backend** (`/app/backend/p1_features.py`):
  - `POST /api/identity/verify/submit` — accepts {id_type, id_number, full_name, id_document_path, selfie_path}; stores submission in `db.identity_submissions` with only `id_number_last4` + a salted hash, never the full number. Idempotent re-submit while pending.
  - `GET /api/identity/verify/status` — returns submission status (not_started/pending/approved/rejected) + is_verified.
  - `GET /api/admin/identity/queue?status=pending|approved|rejected|all` — admin-only queue.
  - `POST /api/admin/identity/{submission_id}/review` — admin approves/rejects with note; approval flips `user.is_verified=true`; rejection emails the renter via `send_email_mocked`.
- ✅ **Frontend**:
  - `VerifyIdentityDialog` component — full submission flow (ID type select, name + number inputs, two image-upload tiles for ID + selfie). Status-aware views: not_started / pending / rejected (with resubmit) / approved.
  - Dashboard: `startVerification` opens the dialog (no longer redirects to Stripe). Banner text/button labels adapt to status (pending = "View status", rejected = "Resubmit").
  - Admin dashboard: new **Identity** tab (`data-testid="admin-tab-identity"`) with pending-count pill, status filter buttons (pending/approved/rejected/all), submission rows showing ID + selfie thumbnails (click to enlarge), approve/reject inline with required reject note.
  - i18n: replaced "Verify with Stripe" → "Verify identity" (EN/FR/ES).
- ✅ **Side improvement**: `GET /api/tools?verified_only=true` filter + `owner_verified` flag stamped on every tool response. ToolCard renders a green `Verified` badge (`data-testid="tool-verified-{tool.id}"`) when the owner is verified. Browse popover adds a `Verified owners only` switch (`data-testid="browse-verified-toggle"`) — toggling it adds `verified_only=true` to the URL and the chip strip.
- ✅ Tests (iter13): 13/13 backend pytest pass; frontend E2E covers submit flow, pending banner, admin queue + approve/reject, verified badge rendering on 17/19 cards, verified-only toggle.

## 12q. Recently-searched row (2026-02-12)
- ✅ **`/app/frontend/src/lib/recentSearches.ts`** — localStorage-backed helper: tracks the 8 user-meaningful URL params (q, category, listing_type, city, state, postal_code, max_price, verified_only), de-dupes by stable hash, caps at 3 entries.
- ✅ **Collapsible row** under the Browse search bar (`data-testid="browse-recent-toggle"`) toggles a flexible chip strip (`data-testid="browse-recent-chips"`). Each chip (`browse-recent-chip-{id}`) shows a human label like `power-tools` or `drill · Toronto`. One click re-applies that filter combination via `URLSearchParams`.
- ✅ Debounced 1.2s after each search so we don't snapshot every keystroke. Survives page refresh (localStorage). Empty/blank searches are skipped.
- ✅ Translations: `browse.recent_searches` in EN/FR/ES.

## 12r. ShareMyKit rebrand + professional theme + hover fix (2026-02-12)
- ✅ **Brand renamed** "ToolShare" → "ShareMyKit" across all visible UI: Header logo, Footer, EN/FR/ES i18n locales, VerifyIdentityDialog, types, dateFormat helper, browser title (`ShareMyKit — Rent tools from your neighbors`), meta description. Backend collections, env DB_NAME, and demo user emails kept stable (still `@toolshare.demo`).
- ✅ **New professional palette — no green**:
  - Primary: `#1E3A5F` (deep navy) — replaces forest green `#2D5A4C`
  - Primary-hover: `#172E4D`
  - Secondary: `#C2410C` (refined burnt-orange) — replaces `#D36135`
  - Background: `#F8FAFC` (cool slate-50) — replaces warm cream `#FDFCF7`
  - Text/Muted/Border/Subtle: slate-900 / slate-600 / slate-200 / slate-100
  - Map markers, status badges, "Verified" badge, Browse "Verified only" toggle all updated to brand-primary (navy) instead of green.
- ✅ **Fixed shadcn hover bug**: `--accent: 18 65% 51%` (orange) caused invisible text on Select/Dropdown item hovers when the item text was also orange. Replaced with `--accent: 210 40% 92%` (soft slate) + dark foreground — readable across every shadcn primitive (Select, DropdownMenu, Command, Menubar).
- ✅ Verified live: Browse renders new theme cleanly; tool cards show navy "Verified" badge; map markers + booking status badges use navy; document title shows ShareMyKit; no green in `view-source`.

## 12s. Owner Inventory dashboard (2026-02-12)
- ✅ **Backend (`/app/backend/routes/tools.py`)**:
  - `GET /api/my/inventory?days=7..90` — returns 21-day default heatmap. Per tool: `{id, title, image, quantity_total, is_available, daily_price, days: [{date, booked, remaining, owner_blocked} × N]}`. Counts pending + approved bookings.
  - `POST /api/tools/{tool_id}/block_dates` — XOR toggle of dates against `tool.unavailable_dates` (dates already blocked get unblocked; new dates get added). Owner-only.
  - `PUT /api/tools/{tool_id}/availability?is_available=true|false` — quick visibility toggle without delete.
- ✅ **Frontend (`/app/frontend/src/pages/Inventory.tsx`)**:
  - New `/inventory` route — auto-redirects to /login when signed out.
  - KPI strip (4 cards): **Utilisation %**, Units booked, Low-stock days (≤30% capacity), Sold-out days.
  - Sticky-header heatmap table — left col shows tool image + title + qty badge + live/hidden toggle (`data-testid="inventory-toggle-availability-{tool_id}"`). 21 day-columns with color-coded cells: full (subtle) → low (orange-30) → critical (orange-70) → sold-out (red) → blocked-by-owner (slate-700).
  - Click any cell to toggle owner stock-out (`data-testid="inventory-cell-{tool_id}-{date}"`, with `data-remaining` and `data-blocked` attrs for testability). Optimistic spinner during request.
  - Legend strip (`data-testid="inventory-legend"`) above the table for the 5 color states.
  - Dashboard "My Listings" tab gets an "Inventory dashboard" link (`data-testid="dashboard-inventory-link"`) above the grid; hidden in empty state.
- ✅ Tests (iter14): 8/8 backend pytest pass · 9/9 frontend E2E flows pass · 100% backend, ~95% frontend success.

## 13. Prioritized Backlog

