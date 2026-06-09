import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { api, imageUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCurrency, CURRENCIES } from "@/lib/currency";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Upload, X, Loader2 } from "lucide-react";

export default function ListTool() {
  const { user, loading } = useAuth();
  const { currency: viewerCurrency } = useCurrency();
  const { t } = useTranslation();
  const nav = useNavigate();
  const [categories, setCategories] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState([]);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    daily_price: "",
    price_currency: viewerCurrency,
    security_deposit: "",
    condition: "Good",
    pickup_available: true,
    delivery_available: false,
    delivery_radius_km: 10,
    address: "",
    city: "",
    postal_code: "",
    lat: "",
    lng: "",
  });

  useEffect(() => {
    api.get("/categories").then(r => setCategories(r.data));
  }, []);

  useEffect(() => {
    if (!loading && !user) nav("/login");
  }, [loading, user, nav]);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const onFiles = async (files) => {
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await api.post("/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        setImages(prev => [...prev, res.data.path]);
      }
    } catch (e) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.category || !form.daily_price || !form.city || !form.lat || !form.lng) {
      toast.error(t("list_tool.fill_required"));
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        category: form.category,
        daily_price: parseFloat(form.daily_price),
        price_currency: form.price_currency,
        security_deposit: parseFloat(form.security_deposit || 0),
        condition: form.condition,
        images,
        location: {
          address: form.address,
          city: form.city,
          postal_code: form.postal_code,
          lat: parseFloat(form.lat),
          lng: parseFloat(form.lng),
        },
        pickup_available: form.pickup_available,
        delivery_available: form.delivery_available,
        delivery_radius_km: parseFloat(form.delivery_radius_km || 0),
        unavailable_dates: [],
      };
      const res = await api.post("/tools", payload);
      toast.success(t("list_tool.tool_listed"));
      nav(`/tools/${res.data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || t("list_tool.create_failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    navigator.geolocation.getCurrentPosition((pos) => {
      upd("lat", pos.coords.latitude.toFixed(6));
      upd("lng", pos.coords.longitude.toFixed(6));
      toast.success("Location set");
    }, () => toast.error("Couldn't get location"));
  };

  return (
    <div className="min-h-screen bg-brand-bg">
      <Header />
      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-heading text-4xl font-extrabold mb-2">{t("list_tool.page_title")}</h1>
        <p className="text-brand-muted mb-8">{t("list_tool.subtitle")}</p>

        <form onSubmit={submit} className="space-y-8 bg-white border border-brand-border rounded-2xl p-8">
          {/* Photos */}
          <section>
            <Label className="font-heading font-bold text-base mb-2 block">{t("list_tool.photos")}</Label>
            <p className="text-sm text-brand-muted mb-4">{t("list_tool.photos_subtitle")}</p>
            <div className="grid grid-cols-3 gap-3">
              {images.map((p, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-brand-subtle border border-brand-border">
                  <img src={imageUrl(p)} alt="" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => setImages(images.filter((_, x) => x !== i))}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {images.length < 6 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-brand-border flex flex-col items-center justify-center cursor-pointer hover:border-brand-primary hover:bg-brand-subtle transition-colors"
                  data-testid="upload-image-label">
                  {uploading ? <Loader2 className="w-6 h-6 animate-spin text-brand-muted" /> : <Upload className="w-6 h-6 text-brand-muted" />}
                  <span className="text-xs mt-2 text-brand-muted">{t("list_tool.add_photo")}</span>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))}
                    data-testid="upload-image-input"/>
                </label>
              )}
            </div>
          </section>

          {/* Basics */}
          <section className="space-y-4">
            <div>
              <Label className="font-bold">{t("list_tool.title")} *</Label>
              <Input value={form.title} onChange={e => upd("title", e.target.value)}
                data-testid="title-input" className="rounded-xl mt-1" placeholder={t("list_tool.title_ph")} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="font-bold">{t("list_tool.category")} *</Label>
                <Select value={form.category} onValueChange={v => upd("category", v)}>
                  <SelectTrigger className="rounded-xl mt-1" data-testid="category-select"><SelectValue placeholder={t("list_tool.category_ph")} /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c.slug} value={c.slug}>{t(`categories.${c.slug}`, c.name)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-bold">{t("list_tool.condition")}</Label>
                <Select value={form.condition} onValueChange={v => upd("condition", v)}>
                  <SelectTrigger className="rounded-xl mt-1" data-testid="condition-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Like New">Like New</SelectItem>
                    <SelectItem value="Good">Good</SelectItem>
                    <SelectItem value="Fair">Fair</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="font-bold">{t("list_tool.description")}</Label>
              <Textarea value={form.description} onChange={e => upd("description", e.target.value)}
                data-testid="description-input"
                className="rounded-xl mt-1 min-h-[120px]"
                placeholder={t("list_tool.description_ph")} />
            </div>
          </section>

          {/* Pricing */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <Label className="font-bold">{t("list_tool.daily_price")} *</Label>
              <Input type="number" min="1" value={form.daily_price} onChange={e => upd("daily_price", e.target.value)}
                data-testid="price-input" className="rounded-xl mt-1" placeholder="25" />
            </div>
            <div>
              <Label className="font-bold">{t("list_tool.currency_label")}</Label>
              <select
                value={form.price_currency}
                onChange={e => upd("price_currency", e.target.value)}
                data-testid="price-currency-select"
                className="w-full h-9 mt-1 rounded-xl border border-brand-border bg-white px-3 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-brand-primary"
              >
                {CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>{c.flag} {c.code}</option>
                ))}
              </select>
              <p className="text-[11px] text-brand-muted mt-1">{t("list_tool.currency_hint")}</p>
            </div>
            <div>
              <Label className="font-bold">{t("list_tool.security_deposit")}</Label>
              <Input type="number" min="0" value={form.security_deposit} onChange={e => upd("security_deposit", e.target.value)}
                data-testid="deposit-input" className="rounded-xl mt-1" placeholder="50" />
            </div>
          </section>

          {/* Location */}
          <section className="space-y-4">
            <div>
              <Label className="font-heading font-bold text-base">{t("list_tool.location_section")}</Label>
              <p className="text-sm text-brand-muted">{t("list_tool.location_subtitle")}</p>
            </div>
            <Input placeholder={t("list_tool.street")} value={form.address} onChange={e => upd("address", e.target.value)}
              className="rounded-xl" data-testid="address-input"/>
            <div className="grid grid-cols-2 gap-4">
              <Input placeholder={`${t("common.city")} *`} value={form.city} onChange={e => upd("city", e.target.value)}
                className="rounded-xl" data-testid="city-input"/>
              <Input placeholder={t("list_tool.postal_code")} value={form.postal_code} onChange={e => upd("postal_code", e.target.value)}
                className="rounded-xl" data-testid="postal-input"/>
            </div>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-4 items-end">
              <Input placeholder="Latitude *" value={form.lat} onChange={e => upd("lat", e.target.value)} className="rounded-xl" data-testid="lat-input"/>
              <Input placeholder="Longitude *" value={form.lng} onChange={e => upd("lng", e.target.value)} className="rounded-xl" data-testid="lng-input"/>
              <Button type="button" variant="outline" onClick={useMyLocation} className="rounded-xl" data-testid="use-my-location">{t("list_tool.use_my_location")}</Button>
            </div>
          </section>

          {/* Pickup/Delivery */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-bold">{t("list_tool.pickup_available")}</Label>
                <p className="text-sm text-brand-muted">{t("list_tool.pickup_subtitle")}</p>
              </div>
              <Switch checked={form.pickup_available} onCheckedChange={v => upd("pickup_available", v)} data-testid="pickup-switch"/>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-bold">{t("list_tool.delivery_available")}</Label>
                <p className="text-sm text-brand-muted">{t("list_tool.delivery_subtitle")}</p>
              </div>
              <Switch checked={form.delivery_available} onCheckedChange={v => upd("delivery_available", v)} data-testid="delivery-switch"/>
            </div>
            {form.delivery_available && (
              <div>
                <Label>{t("list_tool.delivery_radius")}</Label>
                <Input type="number" min="1" value={form.delivery_radius_km} onChange={e => upd("delivery_radius_km", e.target.value)}
                  className="rounded-xl mt-1 w-40"/>
              </div>
            )}
          </section>

          <Button type="submit" disabled={submitting}
            data-testid="submit-listing-btn"
            className="w-full h-12 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-xl font-semibold">
            {submitting ? t("list_tool.publishing") : t("list_tool.publish_listing")}
          </Button>
        </form>
      </div>
    </div>
  );
}
