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

## 13. Prioritized Backlog
- **P0 (done)**: Auth, listings + images, map search, AI assistant, bookings, reviews, favorites
- **P1 (done)**: Stripe Connect, in-app messaging, email notifications (mocked), admin dashboard, identity verification (mocked), buy/sell, insurance plans, featured listings, owner follows + availability alerts, review moderation + condition tags
- **P2**: Real Resend email integration, real Stripe Identity verification (currently mocked toggle), PayPal payouts, native mobile apps, server.py refactor into /routes modules

