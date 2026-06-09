import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef } from "react";

interface MapTool {
  id: string;
  daily_price: number;
  title: string;
  location?: { lat?: number; lng?: number; city?: string; is_approximate?: boolean };
}

interface MapViewProps {
  tools?: MapTool[];
  center?: [number, number] | null;
  onSelect?: (tool: MapTool) => void;
  selectedId?: string | null;
  approximate?: boolean;
  onCenterChange?: (lat: number, lng: number, radius_km: number) => void;
}

// Build a small DivIcon with the price label
function makePinIcon(price: number, active = false) {
  return L.divIcon({
    className: "",
    html: `<div class="tool-marker-pin ${active ? 'is-active' : ''}">$${price}</div>`,
    iconSize: [60, 28],
    iconAnchor: [30, 14],
  });
}

function FitOnce({ tools, center, hasUserMovedRef }: { tools: MapTool[]; center: [number, number]; hasUserMovedRef: React.MutableRefObject<boolean> }) {
  const map = useMap();
  const didFitRef = useRef<boolean>(false);
  useEffect(() => {
    if (didFitRef.current || hasUserMovedRef.current) return;
    if (!tools || tools.length === 0) {
      if (center) {
        map.setView(center, 11);
        didFitRef.current = true;
      }
      return;
    }
    const bounds = L.latLngBounds(
      tools
        .map((tl) => [tl.location?.lat, tl.location?.lng] as [number | undefined, number | undefined])
        .filter(([lat, lng]) => !!lat && !!lng) as [number, number][]
    );
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      didFitRef.current = true;
    }
  }, [tools, map, center, hasUserMovedRef]);
  return null;
}

function MoveListener({ onCenterChange, hasUserMovedRef }: { onCenterChange?: MapViewProps["onCenterChange"]; hasUserMovedRef: React.MutableRefObject<boolean> }) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useMapEvents({
    movestart: () => { hasUserMovedRef.current = true; },
    moveend: (e) => {
      if (!onCenterChange) return;
      // Debounce so rapid drags only fire once
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const map = e.target;
        const c = map.getCenter();
        // Compute radius (km) from center to NE corner of current viewport
        const bounds = map.getBounds();
        const ne = bounds.getNorthEast();
        const radiusMeters = map.distance([c.lat, c.lng], [ne.lat, ne.lng]);
        const radiusKm = Math.max(5, Math.min(200, Math.round(radiusMeters / 1000)));
        onCenterChange(c.lat, c.lng, radiusKm);
      }, 350);
    },
  });
  return null;
}

export default function MapView({ tools = [], center, onSelect, selectedId, approximate = false, onCenterChange }: MapViewProps) {
  const initialCenter: [number, number] = (center as [number, number])
    || (tools[0]?.location?.lat && tools[0]?.location?.lng
      ? [tools[0].location.lat, tools[0].location.lng]
      : [43.6532, -79.3832]);
  const hasUserMovedRef = useRef<boolean>(false);

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
      <FitOnce tools={tools} center={initialCenter} hasUserMovedRef={hasUserMovedRef} />
      <MoveListener onCenterChange={onCenterChange} hasUserMovedRef={hasUserMovedRef} />
      {tools.map((tl) => {
        const lat = tl.location?.lat;
        const lng = tl.location?.lng;
        if (!lat || !lng) return null;
        // Use approximate-mode circle (no exact pin) when location is obfuscated
        const isApprox = approximate || tl.location?.is_approximate;
        if (isApprox) {
          return (
            <Circle
              key={tl.id}
              center={[lat, lng]}
              radius={1500}
              pathOptions={{ color: "#D36135", fillColor: "#D36135", fillOpacity: 0.18, weight: 2 }}
            />
          );
        }
        return (
          <Marker
            key={tl.id}
            position={[lat, lng]}
            icon={makePinIcon(tl.daily_price, selectedId === tl.id)}
            eventHandlers={{ click: () => onSelect && onSelect(tl) }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <div style={{ fontWeight: 700, fontFamily: 'Manrope' }}>{tl.title}</div>
                <div style={{ color: '#545C58', fontSize: 12 }}>{tl.location?.city}</div>
                <div style={{ color: '#D36135', fontWeight: 700, marginTop: 4 }}>${tl.daily_price}/day</div>
                <a href={`/tools/${tl.id}`} style={{ color: '#2D5A4C', fontSize: 12, fontWeight: 600 }}>View details →</a>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
