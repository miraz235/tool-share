// Central domain types for ToolShare frontend.
// These mirror the FastAPI / MongoDB schemas in /app/backend/server.py.

export type ListingType = "rent" | "sell" | "both";
export type BookingStatus = "pending" | "approved" | "declined" | "cancelled" | "completed";
export type PickupMethod = "pickup" | "delivery";
export type InsuranceTier = "none" | "basic" | "premium";
export type ReviewTarget = "owner" | "renter" | "tool";
export type ConditionTag = "like_new" | "good" | "fair" | "poor";
export type ToolCondition = "new" | "like new" | "good" | "fair";

export interface ApiLocation {
  city?: string;
  postal_code?: string | null;
  lat: number;
  lng: number;
  is_approximate?: boolean;
}

export interface PublicUser {
  id: string;
  name: string;
  email?: string;
  picture?: string | null;
  city?: string;
  bio?: string;
  is_verified?: boolean;
  is_admin?: boolean;
  is_suspended?: boolean;
  rating_avg: number;
  rating_count: number;
  created_at?: string;
  /** Only set on /api/follows responses. */
  tool_count?: number;
}

export interface AuthUser extends PublicUser {
  email: string;
}

export interface Tool {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  daily_price: number;
  security_deposit: number;
  condition: string;
  listing_type: ListingType;
  sale_price: number;
  images: string[];
  location: ApiLocation;
  pickup_methods?: PickupMethod[];
  is_available: boolean;
  is_sold?: boolean;
  is_featured?: boolean;
  view_count?: number;
  rating_avg: number;
  rating_count: number;
  created_at?: string;
  distance_km?: number;
  /** Only set on /api/favorites response. */
  alerts_on?: boolean;
  /** Only set on /api/admin/tools. */
  owner_name?: string;
}

export interface Booking {
  id: string;
  tool_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  total_price: number;
  deposit: number;
  rental_price: number;
  insurance_tier: InsuranceTier;
  insurance_fee: number;
  status: BookingStatus;
  pickup_method: PickupMethod;
  delivery_address?: string | null;
  message_to_owner?: string | null;
  paid: boolean;
  dispute_open?: boolean;
  created_at: string;
  updated_at: string;
  /** Enrichment from /api/bookings */
  tool?: Pick<Tool, "title" | "images" | "daily_price"> | Tool;
  counterparty?: PublicUser;
}

export interface BookingInput {
  tool_id: string;
  start_date: string;
  end_date: string;
  pickup_method: PickupMethod;
  delivery_address?: string;
  message_to_owner?: string;
  insurance_tier?: InsuranceTier;
}

export interface Review {
  id: string;
  booking_id: string;
  tool_id: string;
  reviewer_id: string;
  target_user_id?: string | null;
  target_type: ReviewTarget;
  rating: number;
  comment: string;
  condition_tag?: ConditionTag | null;
  hidden?: boolean;
  created_at: string;
  reviewer?: PublicUser | null;
}

export interface ReviewInput {
  booking_id: string;
  rating: number;
  comment?: string;
  target_type: ReviewTarget;
  condition_tag?: ConditionTag;
}

export interface InsuranceTiers {
  none: { daily_fee: number; label: string };
  basic: { daily_fee: number; label: string };
  premium: { daily_fee: number; label: string };
}

export interface Message {
  id: string;
  booking_id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
  sender_name?: string;
}

export interface Purchase {
  id: string;
  tool_id: string;
  buyer_id: string;
  owner_id: string;
  amount: number;
  paid: boolean;
  status: string;
  created_at: string;
}

export interface AIRecommendInput {
  task: string;
  lat?: number;
  lng?: number;
  radius_km?: number;
}

export interface AIRecommendedTool {
  name: string;
  category: string;
  why: string;
  essential: boolean;
  available_listings?: Tool[];
}

export interface AIRecommendation {
  summary: string;
  difficulty: "Easy" | "Moderate" | "Advanced";
  estimated_time: string;
  tools: AIRecommendedTool[];
  safety_tips: string[];
}

export interface AuthLoginResponse {
  token: string;
  user: AuthUser;
}

export interface AdminStats {
  users: number;
  verified_users: number;
  tools: number;
  bookings_total: number;
  approved_bookings: number;
  revenue: number;
  pending_payouts: number;
}

export interface AdminBookingRow extends Booking {
  tool_title?: string;
  renter_name?: string;
  owner_name?: string;
}

export interface AdminReviewRow extends Review {
  reviewer_name?: string;
  target_user_name?: string;
  tool_title?: string;
}

export interface AdminEmailLog {
  id: string;
  to: string;
  subject: string;
  body: string;
  sent_at: string;
}

export type Category = { key: string; label: string; count?: number };
