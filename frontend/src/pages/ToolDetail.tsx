import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, imageUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MapView from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, MapPin, Heart, Calendar as CalIcon, Package, Truck, ShieldCheck, Lock } from "lucide-react";

export default function ToolDetail() {
  const { id } = useParams();
  const { t } = useTranslation();
  const nav = useNavigate();
  const { user } = useAuth();
  const { format, currency: viewerCurrency } = useCurrency();
  const [tool, setTool] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [activeImg, setActiveImg] = useState<number>(0);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [pickupMethod, setPickupMethod] = useState<string>("pickup");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [favorite, setFavorite] = useState<boolean>(false);
  const [booking, setBooking] = useState<boolean>(false);
  const [insuranceTier, setInsuranceTier] = useState<string>("none");
  const [insuranceTiers, setInsuranceTiers] = useState<Record<string, { daily_fee: number; label: string }>>({});
  const [buying, setBuying] = useState<boolean>(false);
  const [unavailableDates, setUnavailableDates] = useState<Set<string>>(new Set());
  const [availability, setAvailability] = useState<Record<string, number>>({});
  const [quantityTotal, setQuantityTotal] = useState<number>(1);
  const [quantity, setQuantity] = useState<number>(1);

  useEffect(() => {
    api.get(`/tools/${id}`).then(r => setTool(r.data)).catch(() => toast.error("Tool not found"));
    api.get(`/reviews`, { params: { tool_id: id } }).then(r => setReviews(r.data)).catch(() => {});
    api.get(`/tools/${id}/unavailable_dates`).then(r => {
      setUnavailableDates(new Set(r.data.dates || []));
      setAvailability(r.data.availability || {});
      setQuantityTotal(Math.max(1, parseInt(r.data.quantity_total) || 1));
    }).catch(() => {});
    api.get(`/insurance/tiers`).then(r => setInsuranceTiers(r.data)).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!user) return;
    api.get("/favorites").then(r => {
      setFavorite(r.data.some(t => t.id === id));
    }).catch(() => {});
  }, [user, id]);

  // Compute days/remaining-stock BEFORE the early return — keeps hooks in stable order.
  const days = tool && dateRange?.from && dateRange?.to
    ? Math.max(1, Math.round((dateRange.to.getTime() - dateRange.from.getTime()) / 86400000) + 1)
    : 0;
  const rangeRemaining = (() => {
    if (!tool || !dateRange?.from || !dateRange?.to) return quantityTotal;
    let minRemaining = quantityTotal;
    const cur = new Date(dateRange.from);
    while (cur <= dateRange.to) {
      const iso = cur.toISOString().slice(0, 10);
      const taken = availability[iso] !== undefined ? quantityTotal - availability[iso] : 0;
      minRemaining = Math.min(minRemaining, quantityTotal - taken);
      cur.setDate(cur.getDate() + 1);
    }
    return Math.max(0, minRemaining);
  })();

  // Clamp the requested quantity whenever the date range or tool changes.
  useEffect(() => {
    if (quantity > rangeRemaining && rangeRemaining > 0) setQuantity(rangeRemaining);
    if (rangeRemaining === 0 && quantity !== 1) setQuantity(1);
    if (quantity < 1) setQuantity(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeRemaining]);

  if (!tool) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <Header />
        <div className="p-16 text-center text-brand-muted">Loading…</div>
      </div>
    );
  }

  const total = days * tool.daily_price * quantity;

  const submitBooking = async () => {
    if (!user) { nav("/login"); return; }
    if (!dateRange?.from || !dateRange?.to) {
      toast.error("Pick rental dates");
      return;
    }
    if (quantity < 1) {
      toast.error("Pick at least 1 unit");
      return;
    }
    if (quantity > rangeRemaining) {
      toast.error(`Only ${rangeRemaining} unit(s) available for those dates`);
      return;
    }
    setBooking(true);
    try {
      const res = await api.post("/bookings", {
        tool_id: tool.id,
        start_date: dateRange.from.toISOString().split('T')[0],
        end_date: dateRange.to.toISOString().split('T')[0],
        pickup_method: pickupMethod,
        delivery_address: pickupMethod === "delivery" ? deliveryAddress : null,
        message_to_owner: message,
        insurance_tier: insuranceTier,
        quantity,
      });
      toast.success("Booking request sent!");
      nav(`/bookings/${res.data.id}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to create booking");
    } finally {
      setBooking(false);
    }
  };

  const submitBuy = async () => {
    if (!user) { nav("/login"); return; }
    if (!window.confirm(`Confirm purchase for ${format(tool.sale_price, { from: tool.price_currency })}?`)) return;
    setBuying(true);
    try {
      const r = await api.post("/purchases", null, { params: { tool_id: tool.id } });
      toast.success("Purchase reserved! Check your dashboard.");
      nav(`/dashboard`);
    } catch (e) {
      toast.error(e.response?.data?.detail || "Purchase failed");
    } finally {
      setBuying(false);
    }
  };

  const toggleFav = async () => {
    if (!user) { nav("/login"); return; }
    try {
      if (favorite) {
        await api.delete(`/favorites/${tool.id}`);
        setFavorite(false);
        toast.success("Removed from favorites");
      } else {
        await api.post(`/favorites/${tool.id}`);
        setFavorite(true);
        toast.success("Saved to favorites");
      }
    } catch (err) {
      console.warn("[ToolDetail] favorite toggle failed", err);
    }
  };

  const fallbackImg = "https://images.unsplash.com/photo-1563440205176-c565cd7302e4?w=1200&q=80&auto=format";
  const images = tool.images?.length ? tool.images : [null];
  const heroImg = images[activeImg] ? imageUrl(images[activeImg]) : fallbackImg;

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />

      <div className="max-w-7xl mx-auto px-6 md:px-8 py-8">
        {/* Title bar */}
        <div className="flex items-start justify-between mb-6 gap-4">
          <div>
            <h1 className="font-heading text-3xl md:text-4xl font-extrabold tracking-tight" data-testid="tool-title">{tool.title}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-brand-muted">
              {tool.rating_count > 0 && (
                <span className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-brand-secondary text-brand-secondary" />
                  <span className="font-semibold text-brand-text">{tool.rating_avg.toFixed(1)}</span>
                  <span>({tool.rating_count})</span>
                </span>
              )}
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {tool.location.city}{!tool.location?.is_approximate && tool.location.postal_code ? `, ${tool.location.postal_code}` : ''}</span>
              <span className="capitalize">· {tool.condition}</span>
            </div>
          </div>
          <Button variant="outline" onClick={toggleFav} data-testid="favorite-toggle"
            className="rounded-xl border-brand-border">
            <Heart className={`w-4 h-4 mr-2 ${favorite ? 'fill-brand-secondary text-brand-secondary' : ''}`} />
            {favorite ? t("common.saved") : t("common.save")}
          </Button>
        </div>

        {/* Gallery */}
        <div className="grid md:grid-cols-[1fr_280px] gap-3 mb-10">
          <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-brand-subtle">
            <img src={heroImg} alt={tool.title} className="w-full h-full object-cover" />
          </div>
          {images.length > 1 && (
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
              {images.slice(0, 4).map((img, i) => (
                <button key={`${img ?? "placeholder"}-${i}`} onClick={() => setActiveImg(i)}
                  className={`aspect-square md:aspect-[16/10] rounded-xl overflow-hidden bg-brand-subtle border-2 ${i === activeImg ? 'border-brand-primary' : 'border-transparent'}`}>
                  <img src={img ? imageUrl(img) : fallbackImg} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-10">
          {/* Left: details */}
          <div>
            {/* Owner */}
            <div className="bg-white border border-brand-border rounded-2xl p-6 mb-6 flex items-center justify-between">
              <Link to={`/profile/${tool.owner_id}`} className="flex items-center gap-4">
                <Avatar className="h-14 w-14">
                  {tool.owner?.picture && <AvatarImage src={tool.owner.picture} />}
                  <AvatarFallback className="bg-brand-primary text-white font-semibold">
                    {tool.owner?.name?.split(" ").map(n => n[0]).slice(0,2).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-heading font-bold text-brand-text">{tool.owner?.name}</div>
                  <div className="text-sm text-brand-muted flex items-center gap-2">
                    {tool.owner?.is_verified && <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-brand-primary" /> Verified</span>}
                    {tool.owner?.rating_count > 0 && <span>· {tool.owner.rating_avg.toFixed(1)} ★ ({tool.owner.rating_count})</span>}
                  </div>
                </div>
              </Link>
            </div>

            <h2 className="font-heading text-xl font-bold mb-3">{t("tool.about")}</h2>
            <p className="text-brand-muted leading-relaxed whitespace-pre-line mb-8">{tool.description}</p>

            <h2 className="font-heading text-xl font-bold mb-3">{t("tool.pickup_delivery")}</h2>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-white border border-brand-border rounded-2xl p-5">
                <Package className="w-5 h-5 text-brand-primary mb-2" />
                <div className="font-semibold">{tool.pickup_available ? t("tool.pickup_available") : t("tool.no_pickup")}</div>
                <div className="text-sm text-brand-muted">{tool.location.city}</div>
              </div>
              <div className="bg-white border border-brand-border rounded-2xl p-5">
                <Truck className="w-5 h-5 text-brand-primary mb-2" />
                <div className="font-semibold">{tool.delivery_available ? t("tool.delivery_radius", { km: tool.delivery_radius_km }) : t("tool.no_delivery")}</div>
                <div className="text-sm text-brand-muted">{tool.delivery_available ? t("tool.by_owner") : "—"}</div>
              </div>
            </div>

            <h2 className="font-heading text-xl font-bold mb-3">{t("tool.location")}</h2>
            {tool.location?.is_approximate && (
              <div className="bg-brand-secondary/10 border border-brand-secondary/30 rounded-xl p-3 mb-3 flex items-start gap-3" data-testid="approximate-location-notice">
                <Lock className="w-4 h-4 text-brand-secondary mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-brand-text">{t("tool.approximate_location")}</div>
                  <div className="text-xs text-brand-muted">{t("tool.exact_location_note")}</div>
                </div>
              </div>
            )}
            {!tool.location?.is_approximate && (tool.location?.address || tool.location?.postal_code) && (
              <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-3 mb-3 flex items-start gap-3" data-testid="exact-location-revealed">
                <ShieldCheck className="w-4 h-4 text-brand-primary mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-brand-text">{t("tool.exact_revealed")}</div>
                  <div className="text-xs text-brand-muted">
                    {[tool.location?.address, tool.location?.city, tool.location?.postal_code].filter(Boolean).join(", ")}
                  </div>
                </div>
              </div>
            )}
            <div className="h-72 rounded-2xl overflow-hidden mb-8">
              <MapView tools={[tool]} center={[tool.location.lat, tool.location.lng] as [number, number]} approximate={!!tool.location?.is_approximate} />
            </div>

            <h2 className="font-heading text-xl font-bold mb-3">{t("tool.reviews")} ({reviews.length})</h2>
            {reviews.length === 0 ? (
              <div className="text-brand-muted text-sm">{t("tool.no_reviews")}</div>
            ) : (
              <div className="space-y-4">
                {reviews.map(r => (
                  <div key={r.id} className="bg-white border border-brand-border rounded-2xl p-5">
                    <div className="flex items-center gap-3 mb-2">
                      <Avatar className="h-8 w-8">
                        {r.reviewer?.picture && <AvatarImage src={r.reviewer.picture} />}
                        <AvatarFallback className="text-xs">{r.reviewer?.name?.[0]}</AvatarFallback>
                      </Avatar>
                      <div className="font-semibold text-sm">{r.reviewer?.name}</div>
                      <div className="flex items-center gap-0.5 ml-auto">
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} className={`w-3.5 h-3.5 ${i <= r.rating ? 'fill-brand-secondary text-brand-secondary' : 'text-brand-border'}`} />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-brand-muted">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: booking card */}
          <div>
            <div className="sticky top-24 bg-white border border-brand-border rounded-2xl p-6 shadow-sm">
              <div className="flex items-baseline gap-1 mb-1">
                <span className="font-heading text-3xl font-extrabold text-brand-secondary">{format(tool.daily_price, { from: tool.price_currency })}</span>
                <span className="text-brand-muted text-sm">{t("common.per_day")}</span>
              </div>
              {(tool.price_currency || "USD").toUpperCase() !== viewerCurrency && (
                <div className="text-[11px] uppercase tracking-wider font-bold text-brand-muted/80 mb-2" data-testid="tool-detail-native">
                  ≈ {tool.daily_price} {(tool.price_currency || "USD").toUpperCase()} {t("common.native_label")}
                </div>
              )}
              {tool.security_deposit > 0 && (
                <div className="text-xs text-brand-muted mb-4">{t("tool.deposit_refundable", { value: format(tool.security_deposit, { from: tool.price_currency }) })}</div>
              )}

              <div className="border border-brand-border rounded-xl p-3 mb-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">{t("tool.rental_dates")}</Label>
                  {quantityTotal > 1 && (
                    <span className="text-[10px] uppercase tracking-wider font-bold text-brand-primary" data-testid="multi-unit-badge">
                      {quantityTotal} {t("tool.units_available", "units total")}
                    </span>
                  )}
                </div>
                <Calendar
                  mode="range"
                  selected={dateRange as any}
                  onSelect={setDateRange as any}
                  disabled={(d) => {
                    if (d < new Date(new Date().setHours(0, 0, 0, 0))) return true;
                    const iso = d.toISOString().slice(0, 10);
                    // Hard block only when fully sold out
                    return unavailableDates.has(iso);
                  }}
                  modifiers={{
                    booked: (d) => unavailableDates.has(d.toISOString().slice(0, 10)),
                    partial: (d) => {
                      const iso = d.toISOString().slice(0, 10);
                      const left = availability[iso];
                      return left !== undefined && left > 0 && left < quantityTotal;
                    },
                  }}
                  modifiersClassNames={{
                    booked: "line-through opacity-50",
                    partial: "ring-2 ring-brand-secondary/60 rounded-md font-semibold",
                  }}
                  className="mt-2"
                  data-testid="booking-calendar"
                />
                {quantityTotal > 1 && (
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-brand-muted">
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm ring-2 ring-brand-secondary/60"></span> {t("tool.partial_stock", "Partial stock")}</span>
                    <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-sm bg-brand-border line-through"></span> {t("tool.sold_out", "Sold out")}</span>
                  </div>
                )}
              </div>

              {/* Quantity selector — only when the tool has multiple units */}
              {quantityTotal > 1 && (
                <div className="mb-4" data-testid="quantity-selector">
                  <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold mb-1 block">
                    {t("tool.quantity_label", "How many units?")}
                  </Label>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center border border-brand-border rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-3 py-2 text-brand-text hover:bg-brand-subtle transition-colors font-bold disabled:opacity-30"
                        disabled={quantity <= 1}
                        data-testid="quantity-decrement-btn"
                        aria-label="Decrease quantity"
                      >−</button>
                      <span className="px-4 font-heading font-bold text-base min-w-[2ch] text-center" data-testid="quantity-value">{quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(rangeRemaining || quantityTotal, q + 1))}
                        className="px-3 py-2 text-brand-text hover:bg-brand-subtle transition-colors font-bold disabled:opacity-30"
                        disabled={quantity >= (rangeRemaining || quantityTotal)}
                        data-testid="quantity-increment-btn"
                        aria-label="Increase quantity"
                      >+</button>
                    </div>
                    <div className="text-xs text-brand-muted leading-tight">
                      {dateRange?.from && dateRange?.to
                        ? t("tool.qty_available_in_range", { remaining: rangeRemaining, total: quantityTotal, defaultValue: "{{remaining}} of {{total}} available for these dates" })
                        : t("tool.qty_available_total", { total: quantityTotal, defaultValue: "Up to {{total}} per booking" })}
                    </div>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold mb-2 block">{t("tool.method")}</Label>
                <RadioGroup value={pickupMethod} onValueChange={setPickupMethod} className="grid grid-cols-2 gap-2">
                  {tool.pickup_available && (
                    <label className={`border border-brand-border rounded-xl p-3 cursor-pointer ${pickupMethod === 'pickup' ? 'bg-brand-primary/5 border-brand-primary' : ''}`}>
                      <RadioGroupItem value="pickup" className="sr-only" />
                      <Package className="w-4 h-4 mb-1" />
                      <div className="text-sm font-semibold">{t("tool.pickup")}</div>
                    </label>
                  )}
                  {tool.delivery_available && (
                    <label className={`border border-brand-border rounded-xl p-3 cursor-pointer ${pickupMethod === 'delivery' ? 'bg-brand-primary/5 border-brand-primary' : ''}`}>
                      <RadioGroupItem value="delivery" className="sr-only" />
                      <Truck className="w-4 h-4 mb-1" />
                      <div className="text-sm font-semibold">{t("tool.delivery")}</div>
                    </label>
                  )}
                </RadioGroup>
              </div>

              {pickupMethod === "delivery" && (
                <div className="mb-4">
                  <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">{t("tool.delivery_address")}</Label>
                  <Textarea value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder={t("tool.delivery_address_ph")}
                    className="mt-1 rounded-xl" data-testid="delivery-address-input" />
                </div>
              )}

              <div className="mb-4">
                <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold">{t("tool.message_to_owner")}</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("tool.message_ph")}
                  className="mt-1 rounded-xl" data-testid="message-input" />
              </div>

              {days > 0 && (
                <div className="bg-brand-subtle rounded-xl p-4 mb-4 text-sm space-y-1">
                  <div className="flex justify-between"><span>{format(tool.daily_price, { from: tool.price_currency })} × {days} {days > 1 ? t("common.days") : t("common.day")}{quantity > 1 ? ` × ${quantity}` : ''}</span><span>{format(total, { from: tool.price_currency })}</span></div>
                  {insuranceTier !== "none" && insuranceTiers[insuranceTier] && (
                    <div className="flex justify-between text-brand-muted"><span>{t("tool.protection")} × {days}{quantity > 1 ? ` × ${quantity}` : ''}</span><span>{format(insuranceTiers[insuranceTier].daily_fee * days * quantity)}</span></div>
                  )}
                  {tool.security_deposit > 0 && <div className="flex justify-between text-brand-muted"><span>{t("tool.deposit_label")}{quantity > 1 ? ` × ${quantity}` : ''}</span><span>{format(tool.security_deposit * quantity, { from: tool.price_currency })}</span></div>}
                  <div className="border-t border-brand-border pt-2 mt-2 flex justify-between font-bold"><span>{t("common.total")}</span>
                    <span>{format(total + (insuranceTiers[insuranceTier]?.daily_fee || 0) * days * quantity + (tool.security_deposit || 0) * quantity, { from: tool.price_currency })}</span>
                  </div>
                </div>
              )}

              {/* Insurance picker */}
              {Object.keys(insuranceTiers).length > 0 && (
                <div className="mb-4">
                  <Label className="text-xs uppercase tracking-wider text-brand-muted font-bold mb-2 block">{t("tool.protection")}</Label>
                  <div className="space-y-2" data-testid="insurance-picker">
                    {Object.entries(insuranceTiers).map(([key, val]) => (
                      <label key={key}
                        className={`flex items-center justify-between border border-brand-border rounded-xl p-3 cursor-pointer transition-colors ${insuranceTier === key ? 'bg-brand-primary/5 border-brand-primary' : ''}`}
                        data-testid={`insurance-tier-${key}`}>
                        <div>
                          <input type="radio" name="insurance" checked={insuranceTier === key}
                            onChange={() => setInsuranceTier(key)} className="sr-only" />
                          <div className="text-sm font-semibold">{val.label}</div>
                        </div>
                        <div className="text-xs font-bold text-brand-secondary">{val.daily_fee > 0 ? `+${format(val.daily_fee)}/${t("common.day")}` : t("common.free")}</div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <Button onClick={submitBooking} disabled={booking || (dateRange?.from && dateRange?.to && rangeRemaining === 0)}
                data-testid="request-booking-btn"
                className="w-full bg-brand-secondary hover:bg-brand-secondary-hover text-white rounded-xl font-semibold h-12">
                {booking
                  ? t("auth.signing_in")
                  : !user
                    ? t("tool.sign_in_to_book")
                    : (dateRange?.from && dateRange?.to && rangeRemaining === 0)
                      ? t("tool.sold_out_for_dates", "Sold out for these dates")
                      : t("tool.request_to_book")}
              </Button>

              {/* Buy option */}
              {(tool.listing_type === "sell" || tool.listing_type === "both") && tool.sale_price > 0 && !tool.is_sold && (
                <div className="border-t border-brand-border mt-4 pt-4">
                  <div className="flex items-baseline justify-between mb-2">
                    <span className="text-xs uppercase tracking-wider text-brand-muted font-bold">{t("tool.buy_outright")}</span>
                    <span className="font-heading text-2xl font-extrabold text-brand-primary">{format(tool.sale_price, { from: tool.price_currency })}</span>
                  </div>
                  <Button onClick={submitBuy} disabled={buying} variant="outline"
                    data-testid="buy-tool-btn"
                    className="w-full rounded-xl font-semibold border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white h-11">
                    {buying ? t("booking.redirecting") : t("tool.buy_now")}
                  </Button>
                </div>
              )}
              <p className="text-xs text-brand-muted text-center mt-3">{t("tool.not_charged_yet")}</p>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
