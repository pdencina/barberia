"use client";

import type { LucideIcon } from "lucide-react";
import {
  CalendarCheck,
  CalendarX,
  ShoppingCart,
  Users,
  Building2,
  CheckCircle2,
  XCircle,
  Lock,
  Inbox,
  Search,
  AlertTriangle,
} from "lucide-react";

/**
 * Clean, professional empty / status states.
 *
 * Replaces the previous mascot ("Oti") images, which looked out of place in a business
 * tool — a raster PNG of a cartoon otter next to financial data. These states use a
 * soft-tinted circle with a crisp vector icon: consistent at any screen density, themed
 * with the brand colour, and visually quiet so the data stays the focus.
 */

type Tone = "neutral" | "brand" | "success" | "danger" | "warning";

const toneClasses: Record<Tone, { ring: string; bg: string; icon: string }> = {
  neutral: { ring: "ring-gray-100", bg: "bg-gray-50", icon: "text-gray-400" },
  brand: { ring: "ring-brand-blue/10", bg: "bg-brand-blue/5", icon: "text-brand-blue" },
  success: { ring: "ring-green-100", bg: "bg-green-50", icon: "text-green-600" },
  danger: { ring: "ring-red-100", bg: "bg-red-50", icon: "text-red-500" },
  warning: { ring: "ring-amber-100", bg: "bg-amber-50", icon: "text-amber-600" },
};

const sizeClasses = {
  sm: { wrap: "w-11 h-11", icon: "w-5 h-5", title: "text-sm", desc: "text-xs", gap: "py-6" },
  md: { wrap: "w-14 h-14", icon: "w-6 h-6", title: "text-base", desc: "text-sm", gap: "py-10" },
  lg: { wrap: "w-16 h-16", icon: "w-7 h-7", title: "text-lg", desc: "text-sm", gap: "py-12" },
};

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  tone = "neutral",
  size = "md",
  action,
  className = "",
}: EmptyStateProps) {
  const t = toneClasses[tone];
  const s = sizeClasses[size];

  return (
    <div className={`flex flex-col items-center justify-center text-center ${s.gap} ${className}`}>
      <div className={`${s.wrap} ${t.bg} ring-4 ${t.ring} rounded-2xl flex items-center justify-center mb-3`}>
        <Icon className={`${s.icon} ${t.icon}`} strokeWidth={1.75} />
      </div>
      <p className={`${s.title} font-semibold text-brand-dark`}>{title}</p>
      {description && <p className={`${s.desc} text-brand-gray mt-1 max-w-xs`}>{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Big centered success mark, e.g. after a completed booking or sale. */
export function SuccessMark({ size = 72, className = "" }: { size?: number; className?: string }) {
  return (
    <div
      className={`mx-auto rounded-full bg-green-50 ring-8 ring-green-100/60 flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <CheckCircle2 className="text-green-600" style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2} />
    </div>
  );
}

/** Re-export the icons most used across empty states so pages import from one place. */
export const EmptyIcons = {
  agenda: CalendarCheck,
  agendaEmpty: CalendarX,
  cart: ShoppingCart,
  clients: Users,
  business: Building2,
  success: CheckCircle2,
  error: XCircle,
  locked: Lock,
  inbox: Inbox,
  search: Search,
  warning: AlertTriangle,
};
