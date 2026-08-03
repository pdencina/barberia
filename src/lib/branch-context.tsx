"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface Branch {
  id: string;
  name: string;
  slug: string;
}

interface BranchContextType {
  branches: Branch[];
  activeBranch: Branch | null;
  setBranch: (branchId: string) => void;
  loading: boolean;
}

const BranchContext = createContext<BranchContextType>({
  branches: [],
  activeBranch: null,
  setBranch: () => {},
  loading: true,
});

export function BranchProvider({ children }: { children: ReactNode }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranch, setActiveBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/branches")
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setBranches(list);

        // Load saved branch from localStorage, or use first one
        const savedId = localStorage.getItem("active_branch_id");
        const saved = list.find((b: Branch) => b.id === savedId);
        setActiveBranch(saved || list[0] || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const setBranch = (branchId: string) => {
    const branch = branches.find((b) => b.id === branchId);
    if (branch) {
      setActiveBranch(branch);
      localStorage.setItem("active_branch_id", branchId);
    }
  };

  return (
    <BranchContext.Provider value={{ branches, activeBranch, setBranch, loading }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
