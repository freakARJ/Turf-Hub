import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AdvancedMarker,
  APIProvider,
  APILoadingStatus,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import { LocateFixed, MapPin, Navigation } from 'lucide-react';
import {
  BANGLADESH_BOUNDS,
  formatBDT,
  haversineDistanceKm,
  isTurfOpenOnDate,
  isWithinBangladesh,
  type Turf,
} from '../types/turf';

interface TurfMapViewProps {
  turfs: Turf[];
  selectedDate: string;
  countOpenSlots: (turf: Turf) => number;
  onSelectTurf: (turf: Turf) => void;
}

const DEFAULT_CENTER = BANGLADESH_BOUNDS.dhakaCenter;

interface TurfMarkerItemProps {
  turf: Turf;
  openSlots: number;
  isOpenToday: boolean;
  distanceKm: number | null;
  isSelected: boolean;
  onSelectMarker: (turfId: string) => void;
  onCloseInfo: () => void;
  onBookTurf: (turf: Turf) => void;
}

const TurfMarkerItem: React.FC<TurfMarkerItemProps> = ({
  turf,
  openSlots,
  isOpenToday,
  distanceKm,
  isSelected,
  onSelectMarker,
  onCloseInfo,
  onBookTurf,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: turf.lat, lng: turf.lng }}
        onClick={() => onSelectMarker(turf.id)}
        title={turf.name}
      >
        <div
          className={`px-2.5 py-1 rounded-xl border shadow-md font-mono tabular-nums text-xs font-bold transition-transform cursor-pointer whitespace-nowrap ${
            isSelected
              ? 'bg-slate-900 border-slate-900 text-white scale-105'
              : isOpenToday && openSlots > 0
                ? 'bg-emerald-700 border-emerald-800 text-white hover:scale-105'
                : 'bg-slate-600 border-slate-700 text-white'
          }`}
        >
          {formatBDT(turf.pricePerHour)}/hr
        </div>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={onCloseInfo} maxWidth={260}>
          <div className="p-1 space-y-2 text-slate-900">
            <div>
              <h4 className="font-semibold text-sm leading-snug">{turf.name}</h4>
              <p className="text-xs text-slate-600 mt-0.5">{turf.address}</p>
            </div>
            <div className="text-xs text-slate-700 font-mono tabular-nums">
              {turf.format} · Max {turf.capacity} players
              {distanceKm !== null ? ` · ${distanceKm.toFixed(1)} km away` : ''}
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-xs font-medium text-emerald-700">
                {isOpenToday ? `${openSlots} slots open` : 'Closed on selected day'}
              </span>
              <button
                type="button"
                onClick={() => onBookTurf(turf)}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold cursor-pointer"
              >
                Book Slot
              </button>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const MapCameraController: React.FC<{
  target: { lat: number; lng: number } | null;
  zoom?: number;
}> = ({ target, zoom = 13 }) => {
  const map = useMap();
  useEffect(() => {
    if (map && target) {
      map.panTo(target);
      map.setZoom(zoom);
    }
  }, [map, target, zoom]);
  return null;
};

const MapStatusFallback: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const status = useApiLoadingStatus();
  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="h-[420px] lg:h-[500px] w-full rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <MapPin className="w-8 h-8 text-slate-400 mb-2" />
        <p className="text-sm font-semibold text-slate-900">Interactive Map Unavailable</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Unable to load Google Maps right now. Use the nearby venue list beside this panel to browse and book slots.
        </p>
      </div>
    );
  }
  return <>{children}</>;
};

export const TurfMapView: React.FC<TurfMapViewProps> = ({
  turfs,
  selectedDate,
  countOpenSlots,
  onSelectTurf,
}) => {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const [selectedTurfId, setSelectedTurfId] = useState<string | null>(turfs[0]?.id || null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [cameraTarget, setCameraTarget] = useState<{ lat: number; lng: number } | null>(null);

  const turfsWithDistance = useMemo(() => {
    const refPoint = userLocation || DEFAULT_CENTER;
    return turfs
      .map((t) => ({
        turf: t,
        distanceKm: userLocation ? haversineDistanceKm(refPoint.lat, refPoint.lng, t.lat, t.lng) : null,
        openSlots: countOpenSlots(t),
        isOpenToday: isTurfOpenOnDate(t, selectedDate),
      }))
      .sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) {
          return a.distanceKm - b.distanceKm;
        }
        return b.openSlots - a.openSlots;
      });
  }, [turfs, userLocation, countOpenSlots, selectedDate]);

  const handleUseMyLocation = useCallback(() => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isWithinBangladesh(coords.lat, coords.lng)) {
          setGeoError('Your GPS is outside Bangladesh — Turf Hub only lists Bangladesh pitches (centered on Dhaka).');
          setUserLocation(null);
          setCameraTarget(DEFAULT_CENTER);
          setLocating(false);
          return;
        }
        setUserLocation(coords);
        setCameraTarget(coords);
        setLocating(false);
      },
      () => {
        setGeoError('Location permission denied. Showing Dhaka turf venues.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  const handleFocusTurf = (t: Turf) => {
    setSelectedTurfId(t.id);
    setCameraTarget({ lat: t.lat, lng: t.lng });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* Nearby List Sidebar */}
      <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 max-h-[520px]">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Bangladesh Turfs Near You</h3>
            <p className="text-xs text-slate-500">
              {userLocation ? 'Sorted by distance inside Bangladesh' : 'Enable GPS inside Bangladesh to sort'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={locating}
            className="min-h-[40px] px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>{locating ? 'Locating...' : 'Near Me'}</span>
          </button>
        </div>

        {geoError && (
          <p className="text-xs text-amber-700 bg-amber-50 px-3 py-2 rounded-xl">{geoError}</p>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {turfsWithDistance.map(({ turf, distanceKm, openSlots, isOpenToday }) => {
            const active = selectedTurfId === turf.id;
            return (
              <div
                key={turf.id}
                className={`p-3.5 rounded-xl border transition-colors ${
                  active
                    ? 'border-emerald-600 bg-emerald-50/40'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => handleFocusTurf(turf)}
                    className="text-left min-w-0 flex-1 cursor-pointer"
                  >
                    <p className="text-sm font-semibold text-slate-900 truncate">{turf.name}</p>
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      {turf.neighborhood} · {turf.format} ({turf.capacity} players)
                    </p>
                  </button>
                  <span className="font-mono tabular-nums text-xs font-bold text-slate-900 shrink-0">
                    {formatBDT(turf.pricePerHour)}/hr
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono tabular-nums text-emerald-700 font-medium">
                    {isOpenToday ? `${openSlots} slots open` : 'Closed'}
                    {distanceKm !== null ? ` · ${distanceKm.toFixed(1)} km` : ''}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleFocusTurf(turf)}
                      className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Navigation className="w-3 h-3" />
                      <span>Pin</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTurf(turf)}
                      className="min-h-[34px] px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-medium cursor-pointer"
                    >
                      Book
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Google Map Canvas */}
      <div className="lg:col-span-8">
        {!apiKey ? (
          <div className="h-[420px] lg:h-[520px] w-full rounded-2xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
            <MapPin className="w-8 h-8 text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-900">Google Maps API Key Required</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Configure VITE_GOOGLE_MAPS_API_KEY in Secrets or enable Google Maps Platform to render the interactive turf locator map.
            </p>
          </div>
        ) : (
          <APIProvider apiKey={apiKey} libraries={['marker']} language="en" region="BD">
            <MapStatusFallback>
              <div className="h-[420px] lg:h-[520px] w-full rounded-2xl overflow-hidden border border-slate-200 bg-slate-100">
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  defaultCenter={turfs[0] ? { lat: turfs[0].lat, lng: turfs[0].lng } : DEFAULT_CENTER}
                  defaultZoom={12}
                  gestureHandling="greedy"
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  style={{ width: '100%', height: '100%' }}
                >
                  <MapCameraController target={cameraTarget} zoom={13} />

                  {userLocation && (
                    <AdvancedMarker position={userLocation} title="Your current location">
                      <Pin background="#2563EB" borderColor="#1D4ED8" glyphColor="#FFFFFF" />
                    </AdvancedMarker>
                  )}

                  {turfsWithDistance.map(({ turf, openSlots, isOpenToday, distanceKm }) => (
                    <TurfMarkerItem
                      key={turf.id}
                      turf={turf}
                      openSlots={openSlots}
                      isOpenToday={isOpenToday}
                      distanceKm={distanceKm}
                      isSelected={selectedTurfId === turf.id}
                      onSelectMarker={(id) => setSelectedTurfId(id)}
                      onCloseInfo={() => setSelectedTurfId(null)}
                      onBookTurf={onSelectTurf}
                    />
                  ))}
                </GoogleMap>
              </div>
            </MapStatusFallback>
          </APIProvider>
        )}
      </div>
    </div>
  );
};
