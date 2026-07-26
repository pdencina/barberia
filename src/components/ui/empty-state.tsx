"use client";

interface EmptyStateProps {
  icon?: string;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl mb-4">
        {icon || "📋"}
      </div>
      <h3 className="text-base font-semibold text-gray-900 mb-1 text-center">{title}</h3>
      <p className="text-sm text-gray-500 text-center max-w-xs mb-4">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 transition-all active:scale-95 shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
