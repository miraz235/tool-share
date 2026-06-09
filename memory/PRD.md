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
{ id, owner_id, title, description, category, daily_price, security_deposit, condition, images[], location: {address, city, postal_code, lat, lng}, pickup_available, delivery_available, delivery_radius_km, unavailable_dates[], is_available, view_count, rating_avg, rating_count, created_at }
```

### bookings
```
{ id, tool_id, renter_id, owner_id, start_date, end_date, total_price, deposit, status, pickup_method, delivery_address, message_to_owner, created_at, updated_at }
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

## 13. Prioritized Backlog

