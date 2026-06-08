import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { api, imageUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth.jsx";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Calendar, Package, Truck, MessageSquare, CreditCard, ShieldCheck, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function BookingDetail() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [booking, setBooking] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [paying, setPaying] = useState(false);
  const [polling, setPolling] = useState(false);
  const scrollRef = useRef(null);

  const fetchBooking = () => api.get(`/bookings/${id}`).then(r => setBooking(r.data));
  const fetchMessages = () => api.get(`/messages/${id}`).then(r => {
    setMessages(r.data);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
  });

  useEffect(() => { fetchBooking(); }, [id]);
  useEffect(() => {
    if (!booking || !user) return;
    fetchMessages();
    const t = setInterval(fetchMessages, 6000);
    return () => clearInterval(t);
  }, [booking?.id, user?.id]);

  // Stripe return — poll for payment status
  useEffect(() => {
    const sessionId = search.get("session_id");
    if (!sessionId || polling) return;
    setPolling(true);
    let attempts = 0;
    const poll = async () => {
      attempts++;
      try {
        const r = await api.get(`/payments/status/${sessionId}`);
        if (r.data.payment_status === "paid") {
          toast.success("Payment successful!");
          await fetchBooking();
          setPolling(false);
          // strip ?session_id
          nav(`/bookings/${id}`, { replace: true });
          return;
        }
        if (r.data.status === "expired" || attempts > 8) {
          toast.error("Payment timed out");
          setPolling(false);
          return;
        }
        setTimeout(poll, 2000);
      } catch {
        setPolling(false);
      }
    };
    poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

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
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const submitReview = async (target_type) => {
    if (rating === 0) { toast.error("Pick a rating"); return; }
    setSubmitting(true);
    try {
      await api.post("/reviews", { booking_id: id, rating, comment, target_type });
      toast.success("Review submitted");
      setRating(0); setComment("");
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setSubmitting(false); }
  };

  const pay = async () => {
    setPaying(true);
    try {
      const r = await api.post("/bookings/checkout", { booking_id: id, origin_url: window.location.origin });
      window.location.href = r.data.url;
    } catch (e) {
      toast.error(e.response?.data?.detail || "Payment failed to start");
      setPaying(false);
    }
  };

  const sendMessage = async () => {
    if (!draft.trim()) return;
    try {
      await api.post("/messages", { booking_id: id, content: draft });
      setDraft("");
      await fetchMessages();
    } catch { toast.error("Failed to send"); }
  };

  if (!booking || !user) return (<div className="min-h-screen bg-brand-bg"><Header /><div className="p-16 text-center text-brand-muted">Loading…</div></div>);

  const isOwner = booking.owner_id === user.id;
  const isRenter = booking.renter_id === user.id;
  const canPay = isRenter && booking.status === "approved" && !booking.paid;
  const canReview = booking.status === "completed" || (booking.status === "approved" && booking.paid);

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-12">
        <Link to="/dashboard" className="text-sm text-brand-muted hover:text-brand-text mb-4 inline-block">← Back to dashboard</Link>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div>
            <div className="bg-white border border-brand-border rounded-2xl p-8 mb-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="flex gap-2 mb-2">
                    <Badge className={`${statusColor[booking.status]} border-0 capitalize`}>{booking.status}</Badge>
                    {booking.paid && <Badge className="bg-green-100 text-green-800 border-0">Paid</Badge>}
                  </div>
                  <h1 className="font-heading text-3xl font-extrabold" data-testid="booking-title">{booking.tool?.title}</h1>
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
                  <div className="text-xs uppercase tracking-wider text-brand-muted font-bold mb-1">Initial message</div>
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
              {booking.status === "approved" && booking.paid && (isOwner || isRenter) && (
                <div className="flex gap-3 pt-4 border-t border-brand-border">
                  <Button onClick={() => updateStatus("completed")} data-testid="complete-btn"
                    className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">Mark as completed</Button>
                  <Button onClick={() => updateStatus("cancelled")} variant="outline" data-testid="cancel-btn"
                    className="rounded-xl">Cancel</Button>
                </div>
              )}
              {booking.status === "pending" && isRenter && (
                <div className="pt-4 border-t border-brand-border">
                  <Button onClick={() => updateStatus("cancelled")} variant="outline" data-testid="cancel-btn"
                    className="rounded-xl">Cancel request</Button>
                </div>
              )}
            </div>

            {/* Payment card */}
            {canPay && (
              <div className="bg-white border border-brand-border rounded-2xl p-6 mb-6">
                <h3 className="font-heading text-xl font-bold mb-2">Pay to confirm rental</h3>
                <p className="text-sm text-brand-muted mb-4">Your booking is approved! Pay now to lock in your dates.</p>
                <div className="bg-brand-subtle rounded-xl p-4 mb-4 text-sm space-y-1">
                  <div className="flex justify-between"><span>Rental</span><span>${booking.total_price}</span></div>
                  {booking.deposit > 0 && <div className="flex justify-between text-brand-muted"><span>Deposit (refundable)</span><span>${booking.deposit}</span></div>}
                  <div className="border-t border-brand-border pt-2 mt-2 flex justify-between font-bold"><span>Total</span><span>${booking.total_price + booking.deposit}</span></div>
                </div>
                <Button onClick={pay} disabled={paying || polling}
                  data-testid="pay-btn"
                  className="w-full h-12 bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-semibold">
                  {paying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Redirecting…</> :
                    polling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying payment…</> :
                    <><CreditCard className="w-4 h-4 mr-2" /> Pay ${booking.total_price + booking.deposit}</>}
                </Button>
                <p className="text-xs text-brand-muted text-center mt-3">Secure checkout via Stripe</p>
              </div>
            )}

            {canReview && (
              <div className="bg-white border border-brand-border rounded-2xl p-6">
                <h3 className="font-heading text-xl font-bold mb-1">Leave a review</h3>
                <p className="text-sm text-brand-muted mb-4">Help the community by sharing your experience.</p>

                <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">Rating</Label>
                <div className="flex gap-1 mt-1 mb-4" data-testid="review-rating">
                  {[1,2,3,4,5].map(i => (
                    <button key={i} onClick={() => setRating(i)} type="button" data-testid={`rating-star-${i}`}>
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

          {/* Messages panel */}
          <div>
            <div className="bg-white border border-brand-border rounded-2xl flex flex-col h-[600px] sticky top-24">
              <div className="border-b border-brand-border p-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-primary" />
                <h3 className="font-heading font-bold">Messages</h3>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="booking-messages">
                {messages.length === 0 ? (
                  <p className="text-sm text-brand-muted text-center py-8">No messages yet. Say hi 👋</p>
                ) : messages.map(m => {
                  const mine = m.sender_id === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-2xl ${mine ? 'bg-brand-primary text-white rounded-br-sm' : 'bg-brand-subtle text-brand-text rounded-bl-sm'}`}>
                        <p className="text-sm leading-relaxed whitespace-pre-line">{m.content}</p>
                        <div className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-brand-muted'}`}>{m.created_at?.slice(11, 16)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-brand-border p-3 flex gap-2">
                <Input value={draft} onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                  placeholder="Type a message…"
                  data-testid="booking-message-input"
                  className="rounded-xl flex-1" />
                <Button onClick={sendMessage} disabled={!draft.trim()}
                  data-testid="booking-message-send"
                  className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
