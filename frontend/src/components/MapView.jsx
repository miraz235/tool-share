import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

// Build a small DivIcon with the price label
function makePinIcon(price, active = false) {
  return L.divIcon({
    className: "",
    html: `<div class="tool-marker-pin ${active ? 'is-active' : ''}">$${price}</div>`,
    iconSize: [60, 28],
    iconAnchor: [30, 14],
  });
}

function FitToBounds({ tools, center }) {
  const map = useMap();
  useEffect(() => {
    if (!tools || tools.length === 0) {
      if (center) map.setView(center, 11);
      return;
    }
    const bounds = L.latLngBounds(
      tools.map(t => [t.location?.lat, t.location?.lng]).filter(([lat, lng]) => lat && lng)
    );
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [tools, map, center]);
  return null;
}

export default function MapView({ tools = [], center, onSelect, selectedId }) {
  const initialCenter = center || (tools[0]?.location ? [tools[0].location.lat, tools[0].location.lng] : [43.6532, -79.3832]);

  return (
    <MapContainer
      center={initialCenter}
      zoom={11}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      data-testid="map-view"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitToBounds tools={tools} center={initialCenter} />
      {tools.map(t => {
        const lat = t.location?.lat;
        const lng = t.location?.lng;
        if (!lat || !lng) return null;
        return (
          <Marker
            key={t.id}
            position={[lat, lng]}
            icon={makePinIcon(t.daily_price, selectedId === t.id)}
            eventHandlers={{ click: () => onSelect && onSelect(t) }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontFamily: 'Manrope' }}>{t.title}</div>
                <div style={{ color: '#545C58', fontSize: 12 }}>{t.location?.city}</div>
                <div style={{ color: '#D36135', fontWeight: 700, marginTop: 4 }}>${t.daily_price}/day</div>
                <a href={`/tools/${t.id}`} style={{ color: '#2D5A4C', fontSize: 12, fontWeight: 600 }}>View details →</a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
