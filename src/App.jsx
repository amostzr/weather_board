import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, ZoomControl, useMap } from 'react-leaflet';
import { CloudRain, Wind, Droplets, Eye, Cloud, Loader2, X, AlertCircle, Search, Mountain, Navigation } from 'lucide-react';
import L from 'leaflet';
import proj4 from 'proj4';
import './App.css';

// ─── Bulletproof Leaflet Icon Fix ──────────────────────────────────────────────
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete L.Icon.Default.prototype._getIconUrl;

const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = defaultIcon;

// ─── Coordinate Projections ──────────────────────────────────────────────────────
const WGS84 = 'EPSG:4326';
const ITM_PROJ = '+proj=tmerc +lat_0=31.73439361111111 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219529.584 +y_0=626907.39 +ellps=GRS80 +towgs84=-48,47,52,0,0,0,0 +units=m +no_defs';
const UTM36N_PROJ = '+proj=utm +zone=36 +datum=WGS84 +units=m +no_defs';

// ITM ↔ WGS84
const itmToWgs84 = (x, y) => { const [lng, lat] = proj4(ITM_PROJ, WGS84, [x, y]); return { lat, lng }; };
const wgs84ToItm = (lat, lng) => { const [x, y] = proj4(WGS84, ITM_PROJ, [lng, lat]); return { x, y }; };

// UTM 36N ↔ WGS84 (covers Lebanon, Syria, Jordan, Israel region)
const utm36nToWgs84 = (e, n) => { const [lng, lat] = proj4(UTM36N_PROJ, WGS84, [e, n]); return { lat, lng }; };
const wgs84ToUtm36n = (lat, lng) => { const [e, n] = proj4(WGS84, UTM36N_PROJ, [lng, lat]); return { easting: e, northing: n }; };

// ─── Layer Definitions ──────────────────────────────────────────────────────────

const LAYERS = [
  {
    id: 'satellite',
    label: 'Satellite',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}&hl=en',
    attribution: '&copy; Google',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    // Static thumbnail tile: z=5 x=20 y=12 (Middle East region)
    thumb: 'https://mt0.google.com/vt/lyrs=y&x=20&y=12&z=5&hl=en',
  },
  {
    id: 'streets',
    label: 'Streets',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains: ['a', 'b', 'c'],
    thumb: 'https://tile.openstreetmap.org/5/20/12.png',
  },
  {
    id: 'terrain',
    label: 'Terrain',
    url: 'https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}&hl=en',
    attribution: '&copy; Google',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    thumb: 'https://mt0.google.com/vt/lyrs=p&x=20&y=12&z=5&hl=en',
  },
  {
    id: 'arcgis',
    label: 'ArcGIS',
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    subdomains: null,
    thumb: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/5/12/20',
  },
];

// ─── Map Utilities ─────────────────────────────────────────────────────────────

function MapClickHandler({ setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });
  return null;
}

function FlyToPosition({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      const lat = Array.isArray(position) ? position[0] : position.lat;
      const lng = Array.isArray(position) ? position[1] : position.lng;
      map.flyTo([lat, lng], Math.max(map.getZoom(), 10), { duration: 1.4 });
    }
  }, [position, map]);
  return null;
}

// WindMarker removed — wind direction is displayed inside the weather card only.

// ─── Custom Layer Switcher (Google Maps Style) ─────────────────────────────────

function LayerSwitcher({ activeLayerId, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const active = LAYERS.find((l) => l.id === activeLayerId) || LAYERS[0];

  return (
    <div
      className="absolute bottom-8 left-6 z-[1000]"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className={`flex gap-2 transition-all duration-300 ${expanded ? 'opacity-100' : 'opacity-100'}`}>
        {LAYERS.map((layer) => (
          <div
            key={layer.id}
            onClick={() => onSelect(layer.id)}
            className="cursor-pointer flex flex-col items-center gap-1 group"
          >
            <div
              className={`w-16 h-16 rounded-xl overflow-hidden border-3 shadow-xl transition-all duration-200
                ${activeLayerId === layer.id
                  ? 'border-[3px] border-blue-500 scale-105 ring-2 ring-blue-300'
                  : 'border-[3px] border-white/70 hover:border-blue-300 hover:scale-105'
                }
                ${!expanded && activeLayerId !== layer.id ? 'hidden' : ''}
              `}
            >
              <img
                src={layer.thumb}
                alt={layer.label}
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
            <span
              className={`text-[10px] font-bold tracking-wide drop-shadow-lg transition-all
                ${activeLayerId === layer.id ? 'text-white' : 'text-white/80'}
                ${!expanded && activeLayerId !== layer.id ? 'hidden' : ''}
              `}
            >
              {layer.label}
            </span>
          </div>
        ))}

        {/* When collapsed, still show the active tile with a hint icon */}
        {!expanded && (
          <div className="flex flex-col items-center gap-1">
            <div className="w-16 h-16 rounded-xl overflow-hidden border-[3px] border-white/70 shadow-xl hover:scale-105 transition-all duration-200 cursor-pointer">
              {/* Show the next layer as preview (Google Maps style) */}
              <img
                src={LAYERS[(LAYERS.findIndex((l) => l.id === activeLayerId) + 1) % LAYERS.length].thumb}
                alt="Switch layer"
                className="w-full h-full object-cover"
                draggable={false}
              />
            </div>
            <span className="text-[10px] font-bold tracking-wide text-white/80 drop-shadow-lg">
              {LAYERS[(LAYERS.findIndex((l) => l.id === activeLayerId) + 1) % LAYERS.length].label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const kmhToKnots = (kmh) => (kmh * 0.539957).toFixed(1);
const calcLCL = (temp, dewpoint) => Math.max(0, Math.round(125 * (temp - dewpoint)));

// ─── Tooltip Component ─────────────────────────────────────────────────────────

function Tooltip({ children, content }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <div onClick={() => setOpen((v) => !v)} className="cursor-pointer">
        {children}
      </div>
      {open && (
        <div className="absolute z-50 bottom-full left-0 mb-2 w-56 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl leading-relaxed pointer-events-none">
          <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-gray-900 rotate-45" />
          {content}
        </div>
      )}
    </div>
  );
}

// ─── Wind Direction Arrow (Card) ────────────────────────────────────────────────

function WindArrow({ degrees }) {
  // degrees = meteorological FROM direction.
  // The Navigation icon points up (north) by default.
  // We rotate it to show where the wind is GOING: (degrees + 180) % 360
  const towardsDeg = (degrees + 180) % 360;
  return (
    <div
      className="shrink-0 text-teal-500"
      style={{ transform: `rotate(${towardsDeg}deg)`, display: 'inline-flex', transition: 'transform 0.6s ease' }}
      title={`Wind blowing towards ${towardsDeg}° (from ${degrees}°)`}
    >
      <Navigation size={20} fill="currentColor" />
    </div>
  );
}

// ─── Search Bar ────────────────────────────────────────────────────────────────

function SearchBar({ onResult }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef(null);

  const search = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed) { setSuggestions([]); return; }

    // ── 1. Detect UTM 36N: Easting ~166k–834k (6-digit), Northing ~3M–4.7M (7-digit)
    const utmMatch = trimmed.match(/^(\d+)[,\s]+(\d+)$/);
    if (utmMatch) {
      const a = parseFloat(utmMatch[1]);
      const b = parseFloat(utmMatch[2]);
      const isUtmA = a >= 100000 && a <= 999999 && b >= 3000000 && b <= 4700000;
      const isUtmB = b >= 100000 && b <= 999999 && a >= 3000000 && a <= 4700000;
      if (isUtmA || isUtmB) {
        const [utmE, utmN] = isUtmA ? [a, b] : [b, a];
        try {
          const { lat, lng } = utm36nToWgs84(utmE, utmN);
          setSuggestions([{
            label: `UTM 36N (E:${utmE.toFixed(0)}, N:${utmN.toFixed(0)}) → ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`,
            lat, lng,
          }]);
        } catch {
          setSuggestions([{ label: 'Invalid UTM 36N coordinates', lat: null, lng: null }]);
        }
        return;
      }
    }

    // ── 2. Detect ITM: Easting 100k–300k, Northing 300k–850k
    const itmMatch = trimmed.match(/^(\d+\.?\d*)[,\s]+(\d+\.?\d*)$/);
    if (itmMatch) {
      const a = parseFloat(itmMatch[1]);
      const b = parseFloat(itmMatch[2]);
      const isItmA = a >= 100000 && a <= 300000 && b >= 300000 && b <= 850000;
      const isItmB = b >= 100000 && b <= 300000 && a >= 300000 && a <= 850000;
      if (isItmA || isItmB) {
        const [itmX, itmY] = isItmA ? [a, b] : [b, a];
        try {
          const { lat, lng } = itmToWgs84(itmX, itmY);
          setSuggestions([{
            label: `ITM (${itmX.toFixed(0)}, ${itmY.toFixed(0)}) → ${lat.toFixed(5)}°, ${lng.toFixed(5)}°`,
            lat, lng,
          }]);
        } catch {
          setSuggestions([{ label: 'Invalid ITM coordinates', lat: null, lng: null }]);
        }
        return;
      }
    }

    // ── 2. Detect WGS84 lat/lon: two small numbers
    const coordMatch = trimmed.match(/^(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        setSuggestions([{ label: `Go to ${lat.toFixed(4)}°, ${lng.toFixed(4)}°`, lat, lng }]);
        return;
      }
    }

    // ── 3. Geocode city/place name via Nominatim
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      );
      const data = await res.json();
      setSuggestions(data.map((d) => ({ label: d.display_name, lat: parseFloat(d.lat), lng: parseFloat(d.lon) })));
    } catch {
      setSuggestions([]);
    } finally {
      setSearching(false);
    }
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    setQuery(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 400);
  };

  const handleSelect = (item) => {
    if (!item.lat || !item.lng) return; // guard invalid ITM
    onResult({ lat: item.lat, lng: item.lng });
    setQuery(item.label.length > 60 ? `${item.label.slice(0, 60)}…` : item.label);
    setSuggestions([]);
  };

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] w-96 max-w-[90vw]">
      <div className="relative flex items-center bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/40">
        <Search className="absolute left-4 text-gray-400 shrink-0" size={18} />
        <input
          id="search-input"
          type="text"
          value={query}
          onChange={handleChange}
          placeholder="City, lat/lon, ITM, or UTM 36N coords…"
          className="w-full pl-11 pr-4 py-3.5 bg-transparent text-gray-800 placeholder-gray-400 text-sm font-medium outline-none rounded-2xl"
        />
        {searching && <Loader2 className="absolute right-4 animate-spin text-blue-400" size={16} />}
      </div>
      {suggestions.length > 0 && (
        <ul className="mt-2 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/40 overflow-hidden">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onClick={() => handleSelect(s)}
              className="px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-none transition-colors truncate"
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Weather Card ──────────────────────────────────────────────────────────────

function WeatherCard({ position, weather, loading, onClose }) {
  const [windInKnots, setWindInKnots] = useState(false);
  const [cloudTooltip, setCloudTooltip] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const cloudRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (cloudRef.current && !cloudRef.current.contains(e.target)) setCloudTooltip(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const lat = Array.isArray(position) ? position[0] : position.lat;
  const lng = Array.isArray(position) ? position[1] : position.lng;
  const lcl = weather ? calcLCL(weather.temperature_2m, weather.dew_point_2m) : 0;
  const elevation = weather?.elevation ?? 0;
  const cloudbaseAMSL = elevation + lcl;

  // Compute UTM 36N coordinates from click position
  let utmCoords = null;
  try { utmCoords = wgs84ToUtm36n(lat, lng); } catch { utmCoords = null; }

  return (
    <div className="absolute top-20 left-6 z-[1000] bg-white/90 backdrop-blur-xl p-5 rounded-3xl shadow-2xl w-80 border border-white/30">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
      >
        <X size={18} />
      </button>

      {/* ─── Info Modal ─────────────────────────────────────────────────── */}
      {showInfo && (
        <div
          className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
          onClick={() => setShowInfo(false)}
        >
          <div
            className="relative bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl border border-white/40 p-6 max-w-sm w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowInfo(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2 bg-blue-500/10 rounded-2xl">
                <CloudRain className="text-blue-600" size={22} />
              </div>
              <h2 className="text-base font-bold text-gray-800">Data Sources &amp; Methods</h2>
            </div>

            <div className="space-y-4 text-sm text-gray-600">
              <div>
                <div className="font-bold text-gray-800 mb-0.5">🌐 Weather Data</div>
                <div>Real-time data from the <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="text-blue-500 underline font-medium">Open-Meteo API</a>, using global models including <span className="font-semibold">ECMWF</span> and <span className="font-semibold">GFS</span>. Updated hourly.</div>
              </div>

              <div>
                <div className="font-bold text-gray-800 mb-0.5">☁️ Cloud Base (LCL)</div>
                <div>Estimated via the Lifted Condensation Level formula:<br />
                  <code className="bg-gray-100 rounded px-1.5 py-0.5 text-xs font-mono text-indigo-700 mt-1 inline-block">
                    LCL (m) = 125 × (T − T<sub>d</sub>)
                  </code>
                </div>
              </div>

              <div>
                <div className="font-bold text-gray-800 mb-0.5">🏔️ Elevation</div>
                <div>Ground elevation is provided by Open-Meteo using the <span className="font-semibold">SRTM 30m</span> digital elevation model.</div>
              </div>

              <div>
                <div className="font-bold text-gray-800 mb-0.5">📐 Coordinates</div>
                <div>ITM (EPSG:2039) and UTM 36N (EPSG:32636) conversions are calculated client-side using the <span className="font-semibold">proj4</span> library. No server round-trip.</div>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-200/60 text-center">
              <a href="https://open-meteo.com" target="_blank" rel="noreferrer" className="text-blue-500 text-xs font-semibold hover:underline">open-meteo.com ↗</a>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-200/50 pr-8">
        <button
          onClick={() => setShowInfo(true)}
          className="p-2 bg-blue-500/10 rounded-2xl shrink-0 hover:bg-blue-500/20 transition-colors cursor-pointer"
          title="About the data sources"
        >
          <CloudRain className="text-blue-600" size={24} />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-800 tracking-tight leading-tight">Location Weather</h1>
          <p className="text-[10px] font-medium text-gray-400 tracking-wider">{lat.toFixed(4)}°, {lng.toFixed(4)}°</p>
        </div>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-10 gap-3">
          <Loader2 className="animate-spin text-blue-500" size={30} />
          <p className="text-gray-500 text-sm font-medium animate-pulse">Fetching data…</p>
        </div>
      ) : weather ? (
        <div className="space-y-3">
          {/* Temperature */}
          <div className="flex flex-col items-center py-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-100/50 shadow-inner">
            <span className="text-5xl font-black text-gray-800 tracking-tighter">{weather.temperature_2m}°</span>
            <span className="text-xs font-semibold text-gray-400 mt-0.5 uppercase tracking-wider">Temperature · 2m AGL</span>
          </div>

          {/* Elevation */}
          <div className="flex items-center gap-3 px-3 py-2.5 bg-amber-50/80 rounded-2xl border border-amber-100/60">
            <Mountain className="text-amber-500 shrink-0" size={18} />
            <div>
              <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Ground Elevation</div>
              <div className="text-sm font-bold text-amber-700">{elevation} m AMSL</div>
            </div>
          </div>

          {/* Metrics Grid — equal-height cards using grid-rows with items-stretch */}
          <div className="grid grid-cols-2 gap-2.5 auto-rows-fr">
            {/* Wind — full-width row */}
            <div className="col-span-2">
              <Tooltip content={`Click to toggle km/h ↔ KT. Wind FROM ${weather.wind_direction_10m ?? '–'}°. 1 km/h ≈ 0.54 KT`}>
                <div
                  onClick={() => setWindInKnots((v) => !v)}
                  className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50/80 rounded-2xl hover:bg-teal-50 border border-transparent hover:border-teal-100 transition-all cursor-pointer select-none h-full"
                >
                  <div className="flex items-center gap-2">
                    <Wind className="text-teal-500 shrink-0" size={18} />
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        Wind {windInKnots ? '(KT)' : '(km/h)'}
                      </div>
                      <div className="text-sm font-bold text-gray-700">
                        {windInKnots ? `${kmhToKnots(weather.wind_speed_10m)} KT` : `${weather.wind_speed_10m} km/h`}
                      </div>
                    </div>
                  </div>
                  {weather.wind_direction_10m != null && (
                    <div className="flex flex-col items-center gap-0.5">
                      <WindArrow degrees={weather.wind_direction_10m} />
                      <span className="text-[9px] font-bold text-gray-400">{weather.wind_direction_10m}° FROM</span>
                    </div>
                  )}
                </div>
              </Tooltip>
            </div>

            {/* Humidity */}
            <Tooltip content="Relative Humidity: >70% = humid; <30% = dry. Affects comfort & cloud formation.">
              <div className="flex items-start gap-2 p-3 bg-gray-50/80 rounded-2xl hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all cursor-pointer select-none h-full">
                <Droplets className="text-blue-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Humidity</div>
                  <div className="text-sm font-bold text-gray-700">{weather.relative_humidity_2m}%</div>
                </div>
              </div>
            </Tooltip>

            {/* Cloud Base AMSL */}
            <div ref={cloudRef} className="relative">
              <div
                onClick={() => setCloudTooltip((v) => !v)}
                className="flex items-start gap-2 p-3 bg-gray-50/80 rounded-2xl hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all cursor-pointer select-none h-full"
              >
                <Cloud className="text-slate-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cloud Base</div>
                  <div className="text-sm font-bold text-gray-700">~{cloudbaseAMSL} m</div>
                  <div className="text-[9px] font-semibold text-slate-400">AMSL · tap for info</div>
                </div>
              </div>
              {cloudTooltip && (
                <div className="absolute z-50 bottom-full left-0 mb-2 w-60 bg-gray-900 text-white text-xs rounded-xl p-3 shadow-2xl leading-relaxed">
                  <div className="absolute -bottom-1.5 left-4 w-3 h-3 bg-gray-900 rotate-45" />
                  <p className="font-bold mb-1 text-blue-300">AMSL vs AGL</p>
                  <p><span className="text-yellow-300">AMSL</span>: {lcl} m LCL + {elevation} m = <b>{cloudbaseAMSL} m</b></p>
                  <p className="mt-1"><span className="text-green-300">AGL</span>: Height above ground. For pilots ≈ <b>{lcl} m</b></p>
                </div>
              )}
            </div>

            {/* Visibility */}
            <Tooltip content="Visibility: <1 km = fog; 1–5 km = haze; >10 km = excellent.">
              <div className="flex items-start gap-2 p-3 bg-gray-50/80 rounded-2xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition-all cursor-pointer select-none h-full">
                <Eye className="text-indigo-400 shrink-0 mt-0.5" size={18} />
                <div>
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Visibility</div>
                  <div className="text-sm font-bold text-gray-700">{Math.round(weather.visibility / 1000)} km</div>
                </div>
              </div>
            </Tooltip>

            {/* UTM 36N — half-width card matching Humidity/Visibility */}
            <div className="flex items-start gap-2 p-3 bg-violet-50/80 rounded-2xl border border-violet-100/60 h-full">
              <div className="shrink-0 mt-0.5 w-[18px] flex items-center justify-center">
                <span className="text-violet-500 text-[10px] font-black leading-none tracking-tight">36N</span>
              </div>
              <div>
                <div className="text-[10px] font-bold text-violet-500 uppercase tracking-wider">UTM 36N</div>
                {utmCoords ? (
                  <>
                    <div className="text-sm font-bold text-violet-800">E: {String(Math.round(utmCoords.easting))}</div>
                    <div className="text-sm font-bold text-violet-800">N: {(() => { const s = String(Math.round(utmCoords.northing)); return s[0] + ',' + s.slice(1); })()}</div>
                  </>
                ) : (
                  <div className="text-xs text-violet-400 italic">N/A</div>
                )}
              </div>
            </div>

            {/* Cloud Cover — full-width progress bar */}
            <div className="col-span-2 px-1 py-2">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cloud Cover</span>
                <span className="text-xs font-bold text-gray-600">{weather.cloud_cover}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-300 to-slate-500 h-2 rounded-full transition-all duration-700"
                  style={{ width: `${weather.cloud_cover}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main App ──────────────────────────────────────────────────────────────────

function App() {
  const [position, setPosition] = useState(null);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeLayerId, setActiveLayerId] = useState('satellite');

  const activeLayer = LAYERS.find((l) => l.id === activeLayerId) || LAYERS[0];

  useEffect(() => {
    let isMounted = true;

    async function fetchWeather() {
      setLoading(true);
      setError(null);

      const lat = Array.isArray(position) ? position[0] : position.lat;
      const lng = Array.isArray(position) ? position[1] : position.lng;

      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
          `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,cloud_cover,visibility,dew_point_2m` +
          `&timezone=auto`
        );
        if (!res.ok) throw new Error('API error');
        const data = await res.json();
        if (isMounted) {
          setWeather({ ...data.current, elevation: data.elevation });
        }
      } catch {
        if (isMounted) {
          setError('Weather data unavailable for this location.');
          setWeather(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (position) {
      fetchWeather();
    } else {
      setWeather(null);
      setError(null);
    }

    return () => { isMounted = false; };
  }, [position]);

  return (
    <div className="relative w-full h-full bg-slate-900">
      {/* Search Bar */}
      <SearchBar onResult={(latlng) => setPosition(latlng)} />

      {/* Error Toast */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1001] bg-red-500 text-white px-5 py-2.5 rounded-full shadow-lg flex items-center gap-3">
          <AlertCircle size={18} />
          <span className="font-medium text-sm">{error}</span>
          <button onClick={() => setError(null)} className="ml-1 hover:bg-red-600 rounded-full p-1 transition-colors">
            <X size={15} />
          </button>
        </div>
      )}

      {/* Weather Card */}
      {position && (
        <WeatherCard
          position={position}
          weather={weather}
          loading={loading}
          onClose={() => setPosition(null)}
        />
      )}

      {/* Custom Layer Switcher */}
      <LayerSwitcher activeLayerId={activeLayerId} onSelect={setActiveLayerId} />

      {/* Intro Hint */}
      {!position && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur-md px-6 py-3 rounded-full shadow-xl border border-white/50 pointer-events-none">
          <p className="font-semibold text-gray-700 flex items-center gap-3 text-sm">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
            </span>
            Click anywhere on the map or search above
          </p>
        </div>
      )}

      <MapContainer
        center={[31.5, 34.8]}
        zoom={7}
        scrollWheelZoom={true}
        zoomControl={false}
        className="w-full h-full z-0"
      >
        {/* Dynamically swapped TileLayer based on activeLayerId */}
        <TileLayer
          key={activeLayer.id}
          attribution={activeLayer.attribution}
          url={activeLayer.url}
          {...(activeLayer.subdomains ? { subdomains: activeLayer.subdomains } : {})}
        />

        <ZoomControl position="topright" />

        {/* Location Marker */}
        {position && (
          <Marker position={position} icon={defaultIcon}>
            <Popup>
              {(Array.isArray(position) ? position[0] : position.lat).toFixed(4)}°,{' '}
              {(Array.isArray(position) ? position[1] : position.lng).toFixed(4)}°
            </Popup>
          </Marker>
        )}


        <MapClickHandler setPosition={setPosition} />
        <FlyToPosition position={position} />
      </MapContainer>
    </div>
  );
}

export default App;
