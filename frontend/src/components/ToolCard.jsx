import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { imageUrl } from "@/lib/api";
import { Heart, MapPin, Star, Sparkles, Tag } from "lucide-react";
import { useState } from "react";

export default function ToolCard({ tool, onToggleFavorite, isFavorite }) {
  const { t } = useTranslation();
  const [imgError, setImgError] = useState(false);
  const fallback = "https://images.unsplash.com/photo-1563440205176-c565cd7302e4?w=800&q=80&auto=format";
  const img = !imgError && tool.images?.[0] ? imageUrl(tool.images[0]) : fallback;
  const forSale = tool.listing_type === "sell" || tool.listing_type === "both";

  return (
    <Link
      to={`/tools/${tool.id}`}
      data-testid={`tool-card-${tool.id}`}
      className="group block bg-white border border-brand-border rounded-2xl overflow-hidden tool-card-shadow hover:-translate-y-1 transition-all duration-300"
    >
      <div className="relative h-56 bg-brand-subtle overflow-hidden">
        <img
          src={img}
          alt={tool.title}
          loading="lazy"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {tool.is_featured && (
            <div className="bg-brand-secondary text-white rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md" data-testid={`featured-badge-${tool.id}`}>
              <Sparkles className="w-3 h-3" /> {t("common.featured")}
            </div>
          )}
          {forSale && tool.sale_price > 0 && (
            <div className="bg-brand-primary text-white rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 shadow-md">
              <Tag className="w-3 h-3" /> {t("common.for_sale")}
            </div>
          )}
        </div>
        {onToggleFavorite && (
          <button
            data-testid={`favorite-btn-${tool.id}`}
            onClick={(e) => { e.preventDefault(); onToggleFavorite(tool.id); }}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center hover:bg-white transition-colors"
            aria-label="Toggle favorite"
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-brand-secondary text-brand-secondary' : 'text-brand-text'}`} />
          </button>
        )}
        {tool.distance_km !== undefined && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur rounded-full px-3 py-1 text-xs font-semibold text-brand-text">
            {tool.distance_km} km
          </div>
        )}
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <h3 className="font-heading font-bold text-lg text-brand-text line-clamp-1">{tool.title}</h3>
          {tool.rating_count > 0 && (
            <div className="flex items-center gap-1 text-sm shrink-0">
              <Star className="w-3.5 h-3.5 fill-brand-secondary text-brand-secondary" />
              <span className="font-semibold">{tool.rating_avg.toFixed(1)}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-brand-muted mb-3">
          <MapPin className="w-3 h-3" />
          <span>{tool.location?.city}</span>
          <span className="mx-1.5">·</span>
          <span className="capitalize">{tool.condition}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-baseline gap-1">
            <span className="font-heading font-extrabold text-xl text-brand-secondary">${tool.daily_price}</span>
            <span className="text-xs text-brand-muted">{t("common.per_day")}</span>
          </div>
          {forSale && tool.sale_price > 0 && (
            <div className="text-xs font-semibold text-brand-primary">${tool.sale_price} {t("common.buy")}</div>
          )}
        </div>
      </div>
    </Link>
  );
}
