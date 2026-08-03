"use client";

import { useBranch } from "@/lib/branch-context";
import { MapPin } from "lucide-react";

export function BranchSelector() {
  const { branches, activeBranch, setBranch, loading } = useBranch();

  // Don't show if only one branch
  if (loading || branches.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <MapPin className="w-4 h-4 text-brand-gray" />
      <select
        value={activeBranch?.id || ""}
        onChange={(e) => setBranch(e.target.value)}
        className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-brand-dark bg-white focus:ring-2 focus:ring-brand-blue focus:border-transparent outline-none"
      >
        {branches.map((b) => (
          <option key={b.id} value={b.id}>{b.name}</option>
        ))}
      </select>
    </div>
  );
}
