import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { api, imageUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Calendar, Package, Truck, MessageSquare, CreditCard, ShieldCheck, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatDateRange, formatTime } from "@/lib/dateFormat";

export default function BookingDetail() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { format } = useCurrency();
  const nav = useNavigate();
  const [booking, setBooking] = useState(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [conditionTag, setConditionTag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [paying, setPaying] = useState(false);
  const [polling, setPolling] = useState(false);
  const [submittedTargets, setSubmittedTargets] = useState(new Set());
  const scrollRef = useRef(null);

  const fetchBooking = () => api.get(`/bookings/${id}`).then(r => setBooking(r.data));
  const fetchMessages = () => api.get(`/messages/${id}`).then(r => {
    setMessages(r.data);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }), 100);
  });
  const fetchMyReviews = async () => {
    if (!user || !booking) return;
    try {
      // pull all reviews on this tool and filter by me + this booking
      const r = await api.get("/reviews", { params: { tool_id: booking.tool_id } });
      const mine = (r.data || []).filter(rv => rv.booking_id === id && rv.reviewer_id === user.id);
      // also need user-target reviews (renter/owner) — fetch by target_user_id
      const targets = new Set(mine.map(rv => rv.target_type));
      // Fetch user-targeted reviews for both renter & owner side
      for (const uid of [booking.renter_id, booking.owner_id]) {
        try {
          const r2 = await api.get("/reviews", { params: { user_id: uid } });
          (r2.data || []).forEach(rv => {
            if (rv.booking_id === id && rv.reviewer_id === user.id) targets.add(rv.target_type);
          });
        } catch (err) {
          console.warn("[BookingDetail] fetch reviews failed for", uid, err);
        }
      }
      setSubmittedTargets(targets);
    } catch (err) {
      console.warn("[BookingDetail] fetchMyReviews failed", err);
    }
  };

  useEffect(() => { fetchBooking(); }, [id]);
  useEffect(() => {
    if (!booking || !user) return;
    fetchMessages();
    fetchMyReviews();
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
          toast.success(t("booking.payment_success"));
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
      } catch (err) {
        console.warn("[BookingDetail] payment poll failed", err);
        setPolling(false);
      }
    };
    poll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const statusColor = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-brand-primary/10 text-brand-primary",
    declined: "bg-red-100 text-red-700",
    cancelled: "bg-slate-100 text-slate-700",
    completed: "bg-sky-100 text-sky-700",
  };

  const updateStatus = async (status) => {
    try {
      await api.put(`/bookings/${id}/status`, { status });
      await fetchBooking();
      toast.success(t(`booking.${status}_toast`));
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
  };

  const submitReview = async (target_type) => {
    if (rating === 0) { toast.error("Pick a rating"); return; }
    setSubmitting(true);
    try {
      const body: { booking_id: string; rating: number; comment: string; target_type: string; condition_tag?: string } = { booking_id: id, rating, comment, target_type };
      if (target_type === "tool" && conditionTag) body.condition_tag = conditionTag;
      await api.post("/reviews", body);
      toast.success("Review submitted");
      setRating(0); setComment(""); setConditionTag("");
      setSubmittedTargets(prev => new Set([...prev, target_type]));
    } catch (e) {
      const detail = e.response?.data?.detail || "Failed";
      toast.error(detail);
      if (e.response?.status === 409) {
        setSubmittedTargets(prev => new Set([...prev, target_type]));
      }
    }
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

  // Messaging closes the day after the rental end_date
  let messagingClosed = false;
  try {
    const end = new Date(`${booking.end_date}T23:59:59`);
    messagingClosed = new Date() > end;
  } catch (e) { /* ignore */ }

  // Reviews are also unlocked once the rental window has ended (paid booking only)
  const canReviewExpanded = canReview || (messagingClosed && booking.paid);

  // What review targets are still available for the current user?
  const availableTargets = [];
  if (isRenter) {
    if (!submittedTargets.has("tool")) availableTargets.push("tool");
    if (!submittedTargets.has("owner")) availableTargets.push("owner");
  }
  if (isOwner && !submittedTargets.has("renter")) availableTargets.push("renter");
  const reviewSectionVisible = canReviewExpanded && availableTargets.length > 0;

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <div className="max-w-5xl mx-auto px-6 md:px-8 py-12">
        <Link to="/dashboard" className="text-sm text-brand-muted hover:text-brand-text mb-4 inline-block">{t("booking.back_dashboard")}</Link>

        <div className="grid lg:grid-cols-[1fr_360px] gap-6">
          <div>
            <div className="bg-white border border-brand-border rounded-2xl p-8 mb-6">
              <div className="flex items-start justify-between gap-4 mb-6">
                <div>
                  <div className="flex gap-2 mb-2">
                    <Badge className={`${statusColor[booking.status]} border-0 capitalize`}>{booking.status}</Badge>
                    {booking.paid && <Badge className="bg-brand-primary/10 text-brand-primary border-0">{t("booking.paid")}</Badge>}
                    {booking.quantity > 1 && (
                      <Badge className="bg-brand-primary/10 text-brand-primary border-0" data-testid="booking-quantity-badge">
                        × {booking.quantity} {t("booking.units", "units")}
                      </Badge>
                    )}
                  </div>
                  <h1 className="font-heading text-3xl font-extrabold" data-testid="booking-title">{booking.tool?.title}</h1>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wider text-brand-muted font-bold">{t("common.total")}</div>
                  <div className="font-heading text-2xl font-extrabold text-brand-secondary">{format(booking.total_price)}</div>
                  {booking.deposit > 0 && <div className="text-xs text-brand-muted">+ {format(booking.deposit)} {t("common.deposit").toLowerCase()}</div>}
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="flex items-center gap-3 p-4 bg-brand-subtle rounded-xl">
                  <Calendar className="w-5 h-5 text-brand-primary" />
                  <div>
                    <div className="text-xs uppercase tracking-wider text-brand-muted font-bold">{t("booking.dates")}</div>
                    <div className="font-semibold text-sm">{formatDateRange(booking.start_date, booking.end_date, i18n.language)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-4 bg-brand-subtle rounded-xl">
                  {booking.pickup_method === 'delivery' ? <Truck className="w-5 h-5 text-brand-primary" /> : <Package className="w-5 h-5 text-brand-primary" />}
                  <div>
                    <div className="text-xs uppercase tracking-wider text-brand-muted font-bold">{t("booking.method")}</div>
                    <div className="font-semibold text-sm capitalize">{t(`tool.${booking.pickup_method}`)}</div>
                  </div>
                </div>
              </div>

              {booking.message_to_owner && (
                <div className="border border-brand-border rounded-xl p-4 mb-4">
                  <div className="text-xs uppercase tracking-wider text-brand-muted font-bold mb-1">{t("booking.initial_message")}</div>
                  <p className="text-sm text-brand-muted">{booking.message_to_owner}</p>
                </div>
              )}

              {isOwner && booking.status === "pending" && (
                <div className="flex gap-3 pt-4 border-t border-brand-border">
                  <Button onClick={() => updateStatus("approved")} data-testid="approve-btn"
                    className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">{t("common.approve")}</Button>
                  <Button onClick={() => updateStatus("declined")} variant="outline" data-testid="decline-btn"
                    className="rounded-xl">{t("common.decline")}</Button>
                </div>
              )}
              {booking.status === "approved" && booking.paid && (isOwner || isRenter) && (
                <div className="flex gap-3 pt-4 border-t border-brand-border">
                  <Button onClick={() => updateStatus("completed")} data-testid="complete-btn"
                    className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">{t("common.complete")}</Button>
                  <Button onClick={() => updateStatus("cancelled")} variant="outline" data-testid="cancel-btn"
                    className="rounded-xl">{t("common.cancel")}</Button>
                </div>
              )}
              {booking.status === "pending" && isRenter && (
                <div className="pt-4 border-t border-brand-border">
                  <Button onClick={() => updateStatus("cancelled")} variant="outline" data-testid="cancel-btn"
                    className="rounded-xl">{t("booking.cancel_request")}</Button>
                </div>
              )}
            </div>

            {/* Payment card */}
            {canPay && (
              <div className="bg-white border border-brand-border rounded-2xl p-6 mb-6">
                <h3 className="font-heading text-xl font-bold mb-2">{t("booking.pay_title")}</h3>
                <p className="text-sm text-brand-muted mb-4">{t("booking.pay_subtitle")}</p>
                <div className="bg-brand-subtle rounded-xl p-4 mb-4 text-sm space-y-1">
                  <div className="flex justify-between"><span>{t("booking.rental")}</span><span>{format(booking.total_price)}</span></div>
                  {booking.deposit > 0 && <div className="flex justify-between text-brand-muted"><span>{t("tool.deposit_label")}</span><span>{format(booking.deposit)}</span></div>}
                  <div className="border-t border-brand-border pt-2 mt-2 flex justify-between font-bold"><span>{t("common.total")}</span><span>{format(booking.total_price + booking.deposit)}</span></div>
                </div>
                <Button onClick={pay} disabled={paying || polling}
                  data-testid="pay-btn"
                  className="w-full h-12 bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-semibold">
                  {paying ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("booking.redirecting")}</> :
                    polling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("booking.verifying")}</> :
                    <><CreditCard className="w-4 h-4 mr-2" /> {t("booking.pay_btn")} ${booking.total_price + booking.deposit}</>}
                </Button>
                <p className="text-xs text-brand-muted text-center mt-3">{t("booking.secure")}</p>
              </div>
            )}

            {reviewSectionVisible && (
              <div className="bg-white border border-brand-border rounded-2xl p-6" data-testid="review-section">
                <h3 className="font-heading text-xl font-bold mb-1">{t("booking.review_title")}</h3>
                <p className="text-sm text-brand-muted mb-4">{t("booking.review_subtitle")}</p>

                <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">{t("booking.rating")}</Label>
                <div className="flex gap-1 mt-1 mb-4" data-testid="review-rating">
                  {[1,2,3,4,5].map(i => (
                    <button key={i} onClick={() => setRating(i)} type="button" data-testid={`rating-star-${i}`}>
                      <Star className={`w-7 h-7 ${i <= rating ? 'fill-brand-secondary text-brand-secondary' : 'text-brand-border'}`} />
                    </button>
                  ))}
                </div>

                <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">{t("booking.comment")}</Label>
                <Textarea value={comment} onChange={e => setComment(e.target.value)}
                  placeholder={t("booking.comment_ph")} className="rounded-xl mt-1 mb-4"
                  data-testid="review-comment" />

                {isRenter && availableTargets.includes("tool") && (
                  <div className="mb-4">
                    <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">{t("booking.condition_label")}</Label>
                    <div className="flex flex-wrap gap-2 mt-1.5" data-testid="condition-tag-group">
                      {[
                        { key: "like_new", label: t("booking.condition_like_new") },
                        { key: "good", label: t("booking.condition_good") },
                        { key: "fair", label: t("booking.condition_fair") },
                        { key: "poor", label: t("booking.condition_poor") },
                      ].map(opt => (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setConditionTag(conditionTag === opt.key ? "" : opt.key)}
                          data-testid={`condition-${opt.key}`}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${conditionTag === opt.key
                            ? "bg-brand-primary text-white border-brand-primary"
                            : "bg-white text-brand-text border-brand-border hover:border-brand-primary"}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-brand-muted mt-1.5">{t("booking.condition_hint")}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {isRenter && availableTargets.includes("tool") && (
                    <Button onClick={() => submitReview("tool")} disabled={submitting}
                      data-testid="review-tool-btn"
                      className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">{t("booking.review_tool")}</Button>
                  )}
                  {isRenter && availableTargets.includes("owner") && (
                    <Button onClick={() => submitReview("owner")} disabled={submitting} variant="outline"
                      data-testid="review-owner-btn" className="rounded-xl">{t("booking.review_owner")}</Button>
                  )}
                  {isOwner && availableTargets.includes("renter") && (
                    <Button onClick={() => submitReview("renter")} disabled={submitting}
                      data-testid="review-renter-btn"
                      className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">{t("booking.review_renter")}</Button>
                  )}
                </div>

                {submittedTargets.size > 0 && (
                  <p className="text-xs text-brand-muted mt-4" data-testid="review-already-submitted">
                    {t("booking.review_already")}
                    {" "}
                    {[...submittedTargets].map(tt => t(`booking.review_${tt}`)).join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Messages panel */}
          <div>
            <div className="bg-white border border-brand-border rounded-2xl flex flex-col h-[600px] sticky top-24">
              <div className="border-b border-brand-border p-4 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-primary" />
                <h3 className="font-heading font-bold">{t("booking.messages")}</h3>
              </div>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="booking-messages">
                {messages.length === 0 ? (
                  <p className="text-sm text-brand-muted text-center py-8">{t("booking.say_hi")}</p>
                ) : messages.map(m => {
                  const mine = m.sender_id === user.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] px-3 py-2 rounded-2xl ${mine ? 'bg-brand-primary text-white rounded-br-sm' : 'bg-brand-subtle text-brand-text rounded-bl-sm'}`}>
                        <p className="text-sm leading-relaxed whitespace-pre-line">{m.content}</p>
                        <div className={`text-[10px] mt-1 ${mine ? 'text-white/70' : 'text-brand-muted'}`}>{formatTime(m.created_at, i18n.language)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-brand-border p-3 flex gap-2">
                {messagingClosed ? (
                  <div className="flex-1 text-xs text-brand-muted text-center py-2" data-testid="messaging-closed-notice">
                    🔒 {t("booking.messaging_closed")}
                  </div>
                ) : (
                  <>
                    <Input value={draft} onChange={e => setDraft(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }}
                      placeholder={t("booking.type_message")}
                      data-testid="booking-message-input"
                      className="rounded-xl flex-1" />
                    <Button onClick={sendMessage} disabled={!draft.trim()}
                      data-testid="booking-message-send"
                      className="bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl">
                      <Send className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
