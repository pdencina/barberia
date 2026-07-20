"use client";

import { useState, createContext, useContext, useCallback } from "react";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning";
}

interface ConfirmContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType>({ confirm: async () => false });

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setDialog({ ...options, resolve });
    });
  }, []);

  const handleConfirm = () => {
    dialog?.resolve(true);
    setDialog(null);
  };

  const handleCancel = () => {
    dialog?.resolve(false);
    setDialog(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {dialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[110]">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-gray-900">{dialog.title}</h3>
            <p className="mt-2 text-sm text-gray-600">{dialog.message}</p>
            <div className="flex gap-2 justify-end mt-6">
              <button
                onClick={handleCancel}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50"
              >
                {dialog.cancelText || "Cancelar"}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${
                  dialog.variant === "danger"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-yellow-600 hover:bg-yellow-700"
                }`}
              >
                {dialog.confirmText || "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
