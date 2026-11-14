import React from 'react';
import { CalendarCheck2, Compass, ShieldCheck, UserCircle2 } from 'lucide-react';
import type { AppTab } from './Header';

interface MobileBottomNavProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  bookingCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onSelectTab,
  bookingCount,
}) => {
  const items: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'explore', label: 'Explore', icon: Compass },
    { id: 'bookings', label: bookingCount > 0 ? `Bookings (${bookingCount})` : 'Bookings', icon: CalendarCheck2 },
    { id: 'profile', label: 'Profile', icon: UserCircle2 },
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      aria-label="Mobile navigation"
    >
      <div className="grid grid-cols-4 h-14 items-center">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                isActive ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
