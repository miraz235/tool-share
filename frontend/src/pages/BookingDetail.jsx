import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, imageUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth.jsx";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Calendar, Package, Truck, MessageSquare } from "lucide-react";
import { toast } from "sonner";

export default function BookingDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchBooking = () => api.get(`/bookings/${id}`).then(r => setBooking(r.data));
  useEffect(() => { fetchBooking(); }, [id]);

  const statusColor = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    declined: "bg-red-100 text-red-700",
    cancelled: "bg-gray-100 text-gray-700",
    completed: "bg-blue-100 text-blue-700",
  };

  const updateStatus = async (status) => {
    try {
      await api.put(`/bookings/${id}/status`, { status });
      await fetchBooking();
      toast.success(`Booking ${status}`);
    } catch { toast.error("Failed"); }
  };

  const submitReview = async (target_type) => {
    if (rating === 0) { toast.error("Pick a rating"); return; }
    setSubmitting(true);
    try {
      await api.post("/reviews", { booking_id: id, rating, comment, target_type });
      toast.success("Review submitted");
      setRating(0); setComment("");
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!booking) return (<div className="min-h-screen bg-brand-bg"><Header /><div className="p-16 text-center text-brand-muted">Loading…</div></div>);
  if (!user) return null;

  const isOwner = booking.owner_id === user.id;
  const isRenter = booking.renter_id === user.id;
  const canReview = booking.status === "completed" || booking.status === "approved";

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <div className="max-w-4xl mx-auto px-6 md:px-8 py-12">
        <Link to="/dashboard" className="text-sm text-brand-muted hover:text-brand-text mb-4 inline-block">← Back to dashboard</Link>

        <div className="bg-white border border-brand-border rounded-2xl p-8 mb-6">
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <Badge className={`${statusColor[booking.status]} border-0 capitalize mb-2`}>{booking.status}</Badge>
              <h1 className="font-heading text-3xl font-extrabold" data-testid="booking-title">
                {booking.tool?.title}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-brand-muted font-bold">Total</div>
              <div className="font-heading text-2xl font-extrabold text-brand-secondary">${booking.total_price}</div>
              {booking.deposit > 0 && <div className="text-xs text-brand-muted">+ ${booking.deposit} deposit</div>}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="flex items-center gap-3 p-4 bg-brand-subtle rounded-xl">
              <Calendar className="w-5 h-5 text-brand-primary" />
              <div>
                <div className="text-xs uppercase tracking-wider text-brand-muted font-bold">Dates</div>
                <div className="font-semibold text-sm">{booking.start_date} → {booking.end_date}</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-4 bg-brand-subtle rounded-xl">
              {booking.pickup_method === 'delivery' ? <Truck className="w-5 h-5 text-brand-primary" /> : <Package className="w-5 h-5 text-brand-primary" />}
              <div>
                <div className="text-xs uppercase tracking-wider text-brand-muted font-bold">Method</div>
                <div className="font-semibold text-sm capitalize">{booking.pickup_method}</div>
              </div>
            </div>
          </div>

          {booking.message_to_owner && (
            <div className="border border-brand-border rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2 text-sm">
                <MessageSquare className="w-4 h-4 text-brand-muted" />
                <span className="font-semibold">Message to owner</span>
              </div>
              <p className="text-sm text-brand-muted">{booking.message_to_owner}</p>
            </div>
          )}

          {isOwner && booking.status === "pending" && (
            <div className="flex gap-3 pt-4 border-t border-brand-border">
              <Button onClick={() => updateStatus("approved")} data-testid="approve-btn"
                className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">Approve booking</Button>
              <Button onClick={() => updateStatus("declined")} variant="outline" data-testid="decline-btn"
                className="rounded-xl">Decline</Button>
            </div>
          )}
          {booking.status === "approved" && (isOwner || isRenter) && (
            <div className="flex gap-3 pt-4 border-t border-brand-border">
              <Button onClick={() => updateStatus("completed")} data-testid="complete-btn"
                className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">Mark as completed</Button>
              <Button onClick={() => updateStatus("cancelled")} variant="outline" data-testid="cancel-btn"
                className="rounded-xl">Cancel</Button>
            </div>
          )}
        </div>

        {canReview && (
          <div className="bg-white border border-brand-border rounded-2xl p-6">
            <h3 className="font-heading text-xl font-bold mb-1">Leave a review</h3>
            <p className="text-sm text-brand-muted mb-4">Help the community by sharing your experience.</p>

            <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">Rating</Label>
            <div className="flex gap-1 mt-1 mb-4" data-testid="review-rating">
              {[1,2,3,4,5].map(i => (
                <button key={i} onClick={() => setRating(i)} type="button"
                  data-testid={`rating-star-${i}`}>
                  <Star className={`w-7 h-7 ${i <= rating ? 'fill-brand-secondary text-brand-secondary' : 'text-brand-border'}`} />
                </button>
              ))}
            </div>

            <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">Comment</Label>
            <Textarea value={comment} onChange={e => setComment(e.target.value)}
              placeholder="How was your experience?" className="rounded-xl mt-1 mb-4"
              data-testid="review-comment" />

            <div className="flex gap-2">
              {isRenter && (
                <>
                  <Button onClick={() => submitReview("tool")} disabled={submitting}
                    data-testid="review-tool-btn"
                    className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">Review tool</Button>
                  <Button onClick={() => submitReview("owner")} disabled={submitting} variant="outline"
                    data-testid="review-owner-btn" className="rounded-xl">Review owner</Button>
                </>
              )}
              {isOwner && (
                <Button onClick={() => submitReview("renter")} disabled={submitting}
                  data-testid="review-renter-btn"
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">Review renter</Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
