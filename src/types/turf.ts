import arenaFloodlitImg from '../assets/images/turf_arena_floodlit_1794691724402.jpg';
import rooftopCityImg from '../assets/images/turf_rooftop_city_1794691724512.jpg';
import indoorDomeImg from '../assets/images/turf_indoor_dome_1794691725462.jpg';
import championshipFieldImg from '../assets/images/turf_championship_field_1794691725445.jpg';

export type TurfFormat = '5v5' | '7v7' | '11v11';
export type PaymentMethod = 'bkash' | 'nagad' | 'rocket' | 'card';
export type PaymentStatus = 'paid' | 'refunded';
export type BookingStatus = 'confirmed' | 'checked_in' | 'cancelled';
export type SlotStatus = 'reserved' | 'maintenance' | 'released';
export type SubscriptionStatus = 'trial_active' | 'active' | 'canceled';

export interface Turf {
  id: string;
  name: string;
  neighborhood: string;
  address: string;
  lat: number;
  lng: number;
  format: TurfFormat;
  capacity: number;
  surface: string;
  pricePerHour: number;
  openHour: number;
  closeHour: number;
  openDays: number[]; // 0 = Sun ... 6 = Sat
  amenities: string[];
  imageKey: string;
  rating: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SlotReservation {
  slotKey: string;
  turfId: string;
  date: string;
  startHour: number;
  status: SlotStatus;
  bookingId: string;
  bookedByUid: string;
  updatedAt?: unknown;
}

export interface Booking {
  id: string;
  bookingCode: string;
  slotKey: string;
  turfId: string;
  turfName: string;
  turfFormat: TurfFormat;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  teamName: string;
  date: string;
  startHour: number;
  durationHours: number;
  basePrice: number;
  serviceFee: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  cardLast4: string;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  phone: string;
  photoUrl: string;
  preferredPosition: string;
  defaultTeamName: string;
  favoriteTurfIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminSubscription {
  uid: string;
  email: string;
  planName: string;
  monthlyPrice: number;
  trialMonths: number;
  trialStartAt: unknown;
  trialEndsAt: unknown;
  status: SubscriptionStatus;
  billingLast4: string;
  autoRenew: boolean;
  updatedAt?: unknown;
}

export const BLUEPRINT_CONSTRAINTS = {
  idPattern: /^[a-zA-Z0-9_-]+$/,
  datePattern: /^\d{4}-\d{2}-\d{2}$/,
  maxNameLength: 100,
  maxAddressLength: 140,
  maxTeamNameLength: 60,
  maxPhoneLength: 24,
  maxEmailLength: 120,
  maxPhotoLength: 40000,
} as const;

export const BANGLADESH_BOUNDS = {
  minLat: 20.0,
  maxLat: 27.0,
  minLng: 88.0,
  maxLng: 93.0,
  dhakaCenter: { lat: 23.8103, lng: 90.4125 },
} as const;

export const OWNER_PRO_MONTHLY_BDT = 2500;

export const TURF_IMAGE_MAP: Record<string, string> = {
  'arena-floodlit': arenaFloodlitImg,
  'rooftop-city': rooftopCityImg,
  'indoor-dome': indoorDomeImg,
  'championship-field': championshipFieldImg,
};

export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export const DEFAULT_TURFS: Omit<Turf, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'northside-arena',
    name: 'Bashundhara Floodlit Arena',
    neighborhood: 'Bashundhara R/A, Dhaka',
    address: 'Block G, Road 14, Bashundhara R/A, Dhaka 1229',
    lat: 23.8135,
    lng: 90.4316,
    format: '7v7',
    capacity: 14,
    surface: 'FIFA Quality Pro 50mm',
    pricePerHour: 3500,
    openHour: 6,
    closeHour: 24,
    openDays: [0, 1, 2, 3, 4, 5, 6],
    amenities: ['LED Floodlights', 'Changing Rooms', 'Free Parking', 'Match Balls'],
    imageKey: 'arena-floodlit',
    rating: 4.9,
    isActive: true,
  },
  {
    id: 'skyline-rooftop',
    name: 'Gulshan Rooftop Pitch',
    neighborhood: 'Gulshan-2, Dhaka',
    address: 'House 42, Road 71, Gulshan-2, Dhaka 1212',
    lat: 23.7949,
    lng: 90.4143,
    format: '5v5',
    capacity: 10,
    surface: 'High-Density Astro 40mm',
    pricePerHour: 2600,
    openHour: 7,
    closeHour: 24,
    openDays: [0, 1, 2, 3, 4, 5, 6],
    amenities: ['City Views', 'Cafe Lounge', 'Bibs Included', 'Shower Suites'],
    imageKey: 'rooftop-city',
    rating: 4.8,
    isActive: true,
  },
  {
    id: 'apex-indoor-dome',
    name: 'Dhanmondi Climate Dome',
    neighborhood: 'Dhanmondi, Dhaka',
    address: 'Satmasjid Road 27, Dhanmondi, Dhaka 1209',
    lat: 23.7511,
    lng: 90.3736,
    format: '7v7',
    capacity: 16,
    surface: 'ShockPad Pro 55mm',
    pricePerHour: 4200,
    openHour: 6,
    closeHour: 24,
    openDays: [0, 1, 2, 3, 4, 5, 6],
    amenities: ['Monsoon-Proof Roof', 'Digital Scoreboard', 'Spectator Stand', 'Lockers'],
    imageKey: 'indoor-dome',
    rating: 4.9,
    isActive: true,
  },
  {
    id: 'metro-stadium',
    name: 'Uttara Championship Ground',
    neighborhood: 'Uttara Sector 11, Dhaka',
    address: 'Gareeb-E-Newaz Ave, Sector 11, Uttara, Dhaka 1230',
    lat: 23.8759,
    lng: 90.3895,
    format: '11v11',
    capacity: 22,
    surface: 'FIFA Pro Hybrid Turf',
    pricePerHour: 7500,
    openHour: 6,
    closeHour: 23,
    openDays: [0, 1, 2, 3, 4, 5, 6],
    amenities: ['Full 11-a-Side', 'Covered Dugouts', 'Referee Room', 'Broadcast Lighting'],
    imageKey: 'championship-field',
    rating: 5.0,
    isActive: true,
  },
];

export function formatBDT(amount: number, showDecimals: boolean = false): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `৳${safe.toLocaleString('en-BD', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  })}`;
}

export function isValidBangladeshPhone(raw: string): boolean {
  const digits = raw.replace(/[\s\-()]/g, '');
  return /^(\+?880|0)1[3-9]\d{8}$/.test(digits);
}

export function isWithinBangladesh(lat: number, lng: number): boolean {
  return (
    lat >= BANGLADESH_BOUNDS.minLat &&
    lat <= BANGLADESH_BOUNDS.maxLat &&
    lng >= BANGLADESH_BOUNDS.minLng &&
    lng <= BANGLADESH_BOUNDS.maxLng
  );
}

export function getDhakaNow(): { isoDate: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  parts.forEach((p) => {
    map[p.type] = p.value;
  });
  return {
    isoDate: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour || '0'),
  };
}

export function formatHourRange(startHour: number, durationHours: number = 1): string {
  const fmt = (h: number) => `${String(h % 24).padStart(2, '0')}:00`;
  return `${fmt(startHour)} – ${fmt(startHour + durationHours)}`;
}

export function formatSlotKey(turfId: string, date: string, startHour: number): string {
  return `${turfId}_${date}_${String(startHour).padStart(2, '0')}`;
}

export function isTurfOpenOnDate(turf: Turf, dateIso: string): boolean {
  if (!turf.openDays || turf.openDays.length === 0) return true;
  const parts = dateIso.split('-').map(Number);
  if (parts.length !== 3) return true;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return turf.openDays.includes(dt.getDay());
}

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getUpcomingDates(count: number = 7): { iso: string; dayShort: string; dayNum: string; label: string }[] {
  const result: { iso: string; dayShort: string; dayNum: string; label: string }[] = [];
  const { isoDate } = getDhakaNow();
  const [y, m, day] = isoDate.split('-').map(Number);
  const base = new Date(y, (m || 1) - 1, day || 1);
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    const dayShort = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = String(d.getDate());
    const label = i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    result.push({ iso, dayShort, dayNum, label });
  }
  return result;
}
