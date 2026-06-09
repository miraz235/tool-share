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

function FitOnce({ tools, center, hasUserMovedRef, programmaticMoveRef }: { tools: MapTool[]; center: [number, number]; hasUserMovedRef: React.MutableRefObject<boolean>; programmaticMoveRef: React.MutableRefObject<boolean> }) {
  const map = useMap();
  const didFitRef = useRef<boolean>(false);
  useEffect(() => {
    if (didFitRef.current || hasUserMovedRef.current) return;
    const doFit = (): boolean => {
      if (!tools || tools.length === 0) {
        if (center) {
          // Mark this as a programmatic move so MoveListener ignores it
          programmaticMoveRef.current = true;
          map.setView(center, 12);
          didFitRef.current = true;
          return true;
        }
        return false;
      }
      const bounds = L.latLngBounds(
        tools
          .map((tl) => [tl.location?.lat, tl.location?.lng] as [number | undefined, number | undefined])
          .filter(([lat, lng]) => !!lat && !!lng) as [number, number][]
      );
      if (bounds.isValid()) {
        programmaticMoveRef.current = true;
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        didFitRef.current = true;
        return true;
      }
      return false;
    };
    doFit();
  }, [tools, map, center, hasUserMovedRef, programmaticMoveRef]);
  return null;
}

function MoveListener({ onCenterChange, hasUserMovedRef, programmaticMoveRef }: { onCenterChange?: MapViewProps["onCenterChange"]; hasUserMovedRef: React.MutableRefObject<boolean>; programmaticMoveRef: React.MutableRefObject<boolean> }) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useMapEvents({
    // Leaflet emits `dragstart` only on real user drags. movestart fires on programmatic
    // setView/fitBounds too — so we listen to dragstart + zoomstart for "real" interactions.
    dragstart: () => { hasUserMovedRef.current = true; },
    zoomstart: (e: any) => {
      // Programmatic zoom (fitBounds) also fires zoomstart, so check originalEvent
      if (e?.originalEvent) hasUserMovedRef.current = true;
    },
    moveend: (e) => {
      if (!onCenterChange) return;
      if (programmaticMoveRef.current) {
        // This moveend was fired by our own setView/fitBounds — swallow it
        programmaticMoveRef.current = false;
        return;
      }
      // Capture coords/radius now (before any pending re-render destroys the map ref)
      const map = e.target;
      const c = map.getCenter();
      const bounds = map.getBounds();
      const ne = bounds.getNorthEast();
      const radiusMeters = map.distance([c.lat, c.lng], [ne.lat, ne.lng]);
      const radiusKm = Math.max(5, Math.min(200, Math.round(radiusMeters / 1000)));
      // Debounce so rapid drags only fire one search request
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
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
  const programmaticMoveRef = useRef<boolean>(false);

  return (
    <MapContainer
      center={initialCenter}
      zoom={12}
      scrollWheelZoom
      style={{ height: "100%", width: "100%" }}
      data-testid="map-view"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitOnce tools={tools} center={initialCenter} hasUserMovedRef={hasUserMovedRef} programmaticMoveRef={programmaticMoveRef} />
      <MoveListener onCenterChange={onCenterChange} hasUserMovedRef={hasUserMovedRef} programmaticMoveRef={programmaticMoveRef} />
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
