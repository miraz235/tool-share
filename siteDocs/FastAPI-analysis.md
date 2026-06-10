## MongoDB Schemas

### `users`
- `id`: string (`user_<uuid>`)
- `email`: string
- `password_hash`: string or `null`
- `name`: string
- `picture`: optional string
- `bio`: optional string
- `city`: optional string
- `auth_provider`: `"email"` | `"google"`
- `rating_avg`: float
- `rating_count`: int
- `is_verified`: bool
- `is_admin`: bool
- `is_suspended`: bool
- `created_at`: ISO timestamp string

### `sessions`
- `session_token`: string
- `user_id`: string
- `expires_at`: ISO timestamp string
- `created_at`: ISO timestamp string

### `files`
- `id`: string UUID
- `storage_path`: string
- `owner_id`: string
- `original_filename`: string
- `content_type`: string
- `size`: int
- `is_deleted`: bool
- `created_at`: ISO timestamp string

### `tools`
- `id`: string (`tool_<uuid>`)
- `owner_id`: string
- `title`: string
- `description`: string
- `category`: string
- `daily_price`: float
- `security_deposit`: float
- `condition`: `"Like New" | "Good" | "Fair"`
- `images`: list[string]
- `location`: object with `address`, `city`, `postal_code`, `lat`, `lng`
- `pickup_available`: bool
- `delivery_available`: bool
- `delivery_radius_km`: float
- `unavailable_dates`: list[string]
- `listing_type`: `"rent" | "sell" | "both"`
- `sale_price`: float
- `price_currency`: `"USD" | "CAD" | "EUR" | "GBP" | "MXN" | "AUD"`
- `is_available`: bool
- `is_sold`: bool
- `is_featured`: bool
- `view_count`: int
- `rating_avg`: float
- `rating_count`: int
- `created_at`: ISO timestamp string

### `bookings`
- `id`: string (`bk_<uuid>`)
- `tool_id`: string
- `renter_id`: string
- `owner_id`: string
- `start_date`: ISO date string
- `end_date`: ISO date string
- `total_price`: float
- `deposit`: float
- `rental_price`: float
- `insurance_tier`: `"none" | "basic" | "premium"`
- `insurance_fee`: float
- `status`: `"pending" | "approved" | "declined" | "cancelled" | "completed"`
- `pickup_method`: `"pickup" | "delivery"`
- `delivery_address`: optional string
- `message_to_owner`: optional string
- `paid`: bool
- `created_at`: ISO timestamp string
- `updated_at`: ISO timestamp string

### `purchases`
- `id`: string (`pur_<uuid>`)
- `tool_id`: string
- `buyer_id`: string
- `owner_id`: string
- `amount`: float
- `paid`: bool
- `status`: string
- `created_at`: ISO timestamp string

### `messages`
- `id`: string (`msg_<uuid>`)
- `booking_id`: string
- `sender_id`: string
- `recipient_id`: string
- `content`: string
- `read`: bool
- `created_at`: ISO timestamp string

### `identity_sessions`
- `id`: string (Stripe verification session id)
- `user_id`: string
- `status`: string
- `created_at`: ISO timestamp string

### `email_log`
- `id`: string UUID
- `to`: string
- `subject`: string
- `body`: string
- `sent_at`: ISO timestamp string
- `mocked`: bool

### `fx_cache`
- `id`: string (`rates_usd`)
- `rates`: object map currency -> float
- `fetched_at`: ISO timestamp string

### `owner_follows`
- `id`: string UUID
- `user_id`: string
- `owner_id`: string
- `created_at`: ISO timestamp string

### `favorites`
- `id`: string UUID
- `user_id`: string
- `tool_id`: string
- `alerts_on`: bool
- `created_at`: ISO timestamp string

### `payment_transactions`
- `id`: string UUID
- `session_id`: string
- `booking_id`: string
- `user_id`: string
- `amount`: float
- `currency`: string
- `platform_fee`: float
- `owner_payout`: float
- `payment_status`: string
- `status`: string
- `metadata`: object
- `created_at`: ISO timestamp string

---

## API Endpoints

### Core
- `GET /api/`
- `GET /api/categories`

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/google/session`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `PUT /api/auth/profile`

### Upload / files
- `POST /api/upload`
- `GET /api/files/{path:path}`

### Tools
- `POST /api/tools`
- `GET /api/tools`
- `GET /api/tools/{tool_id}`
- `GET /api/tools/{tool_id}/unavailable_dates`
- `PUT /api/tools/{tool_id}`
- `DELETE /api/tools/{tool_id}`
- `GET /api/my/tools`

### Pricing / utility
- `GET /api/fx/rates`
- `GET /api/insurance/tiers`

### Purchases
- `POST /api/purchases`
- `GET /api/purchases`

### Bookings
- `POST /api/bookings`
- `GET /api/bookings`
- `GET /api/bookings/{booking_id}`
- `PUT /api/bookings/{booking_id}/status`

### Favorites
- `POST /api/favorites/{tool_id}`
- `DELETE /api/favorites/{tool_id}`
- `GET /api/favorites`

### Owner follows
- `POST /api/follows/{owner_id}`
- `DELETE /api/follows/{owner_id}`
- `GET /api/follows`
- `GET /api/follows/check/{owner_id}`

### Reviews
- `POST /api/reviews`
- `GET /api/reviews`

### Public users
- `GET /api/users/{user_id}`

### AI
- `GET /api/ai/quota`
- `POST /api/ai/recommend`

### P1 / extended features
- `POST /api/messages`
- `GET /api/messages/threads`
- `GET /api/messages/{booking_id}`
- `GET /api/messages/unread/count`
- `POST /api/identity/verify/start`
- `GET /api/identity/verify/status`
- `POST /api/bookings/checkout`
- `GET /api/payments/status/{session_id}`
- `POST /api/webhook/stripe`

---

## Auth Flow

- `POST /api/auth/register` creates a new user with bcrypt password hash and returns JWT plus serialized user.
- `POST /api/auth/login` validates email/password, returns JWT plus user.
- `POST /api/auth/google/session` exchanges `session_id` with an external Emergent auth endpoint, creates or updates a Google user, stores a session record, and returns JWT.
- `GET /api/auth/me` authenticates the current user.
- `POST /api/auth/logout` deletes session cookie state and removes server-side session.
- `PUT /api/auth/profile` updates authenticated user profile fields.

### Authentication mechanism
- `current_user` dependency checks:
  1. cookie `session_token` → `sessions` collection → valid expiry → loads user
  2. `Authorization: Bearer <token>` → JWT decode → loads user
- `optional_user` returns the authenticated user if available, otherwise `None`.

---

## Module Boundaries

### `backend/server.py`
- Main FastAPI application and router creation
- MongoDB client and collection access
- auth models, helpers, and routes
- upload/file storage integration
- core marketplace routes: tools, bookings, purchases, favorites, follows, reviews, public users
- AI assistant logic and quota enforcement
- route mounting, CORS middleware, startup/shutdown lifecycle
- imports and integrates P1 router

### `backend/p1_features.py`
- Additional P1 feature router builder
- messaging system endpoints
- Stripe identity verification endpoints
- Stripe checkout/payment endpoints and webhook handling
- admin guard helper
- email mock logging helper
- booking conflict helper

### Cross-cutting boundaries
- `db` is shared between `server.py` and `p1_features.py`
- `current_user` dependency is injected into P1 router
- `send_email_mocked` is used by both modules for notification side effects
- Stripe and external services are isolated behind P1 feature code

### External integration points
- Emergent object storage via `put_object` / `get_object`
- Emergent auth endpoint for Google sessions
- Stripe via `stripe` package and custom P1 checkout helper
- LLM assistant via `LlmChat` from `emergentintegrations.llm`
