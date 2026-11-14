import React, { useState } from 'react';
import { Heart, MapPin, Star } from 'lucide-react';
import { formatBDT, isTurfOpenOnDate, TURF_IMAGE_MAP, type Turf } from '../types/turf';

interface TurfCardProps {
  turf: Turf;
  selectedDate: string;
  openSlotCount: number;
  distanceKm?: number | null;
  isFavorite: boolean;
  onToggleFavorite?: (turfId: string) => void;
  onSelectTurf: (turf: Turf) => void;
}

export const TurfCard: React.FC<TurfCardProps> = ({
  turf,
  selectedDate,
  openSlotCount,
  distanceKm,
  isFavorite,
  onToggleFavorite,
  onSelectTurf,
}) => {
  const [imgError, setImgError] = useState(false);
  const imgSrc = TURF_IMAGE_MAP[turf.imageKey] || '';
  const openToday = isTurfOpenOnDate(turf, selectedDate);

  return (
    <article className="group bg-white border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] bg-emerald-950 overflow-hidden">
        {imgSrc && !imgError ? (
          <img
            src={imgSrc}
            alt={`${turf.name} — ${turf.format} football turf pitch`}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-900 to-slate-900 text-emerald-100 p-6 text-center">
            <span className="text-sm font-semibold">{turf.name}</span>
            <span className="text-xs text-emerald-300 mt-1">{turf.format} Synthetic Pitch</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-slate-950/75 via-slate-950/30 to-transparent pointer-events-none" />
        <div className="absolute bottom-3 left-3.5 right-3.5 flex items-end justify-between text-white">
          <span className="text-xs font-medium tracking-tight flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
            <span className="truncate">
              {turf.neighborhood}
              {distanceKm !== null && distanceKm !== undefined ? ` · ${distanceKm.toFixed(1)} km` : ''}
            </span>
          </span>
          <span className="font-mono tabular-nums text-xs font-semibold flex items-center gap-1 shrink-0">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            {turf.rating.toFixed(1)}
          </span>
        </div>

        {onToggleFavorite && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(turf.id);
            }}
            aria-label={isFavorite ? `Remove ${turf.name} from favorites` : `Save ${turf.name} to favorites`}
            className="absolute top-2.5 right-2.5 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-950/45 backdrop-blur-sm text-white hover:bg-slate-950/65 transition-colors cursor-pointer"
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500 text-rose-500' : 'text-white'}`} />
          </button>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 leading-snug">
            {turf.name}
          </h3>
          <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
            <span>{turf.format}</span>
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span>Max {turf.capacity} players</span>
            <span aria-hidden="true" className="mx-1.5">·</span>
            <span>{turf.surface}</span>
          </p>
        </div>

        <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="font-mono tabular-nums text-lg font-bold text-slate-900">
                {formatBDT(turf.pricePerHour)}
              </span>
              <span className="text-xs text-slate-500">/ hour</span>
            </div>
            <p className={`font-mono tabular-nums text-[11px] font-medium mt-0.5 ${openToday ? 'text-emerald-700' : 'text-amber-700'}`}>
              {openToday ? `${openSlotCount} slots open` : 'Closed on selected day'}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onSelectTurf(turf)}
            className="min-h-[44px] px-4 py-2 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer active:scale-[0.98]"
          >
            Book Slot
          </button>
        </div>
      </div>
    </article>
  );
};
