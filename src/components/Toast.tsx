import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, Sparkles, X, RotateCcw } from 'lucide-react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'info' | 'error' | 'ai';
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none max-w-sm w-full px-4 sm:px-0">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
};

const ToastItem: React.FC<{ toast: ToastMessage; onDismiss: (id: string) => void }> = ({
  toast,
  onDismiss,
}) => {
  const duration = toast.duration || 4000;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) {
        clearInterval(interval);
        onDismiss(toast.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, toast.id, onDismiss]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />;
      case 'ai':
        return <Sparkles className="w-4 h-4 text-[#e08264] shrink-0 animate-pulse" />;
      default:
        return <Info className="w-4 h-4 text-sky-400 shrink-0" />;
    }
  };

  const getBorderGlow = () => {
    switch (toast.type) {
      case 'ai':
        return 'border-[#e08264]/40 shadow-[0_4px_20px_rgba(224,130,100,0.15)]';
      case 'success':
        return 'border-emerald-500/30';
      case 'error':
        return 'border-rose-500/30';
      default:
        return 'border-white/10';
    }
  };

  return (
    <div className={`pointer-events-auto relative overflow-hidden flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#141418]/95 backdrop-blur-md text-slate-100 border ${getBorderGlow()} shadow-2xl text-xs font-medium transition-all animate-card-entrance`}>
      {/* Subtle Progress Bar */}
      <div
        className="absolute bottom-0 left-0 h-[2px] bg-[#d97757]/80 dark:bg-[#e08264]/80 transition-all duration-75"
        style={{ width: `${progress}%` }}
      />

      <div className="flex items-center gap-2.5 min-w-0">
        {getIcon()}
        <span className="truncate text-slate-100">{toast.message}</span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              onDismiss(toast.id);
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#d97757]/20 hover:bg-[#d97757]/35 text-[#e08264] hover:text-white font-semibold font-mono text-[11px] transition-all active:scale-95 border border-[#e08264]/30"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{toast.action.label}</span>
          </button>
        )}
        <button
          onClick={() => onDismiss(toast.id)}
          className="text-slate-400 hover:text-slate-200 p-1 rounded-md hover:bg-white/10 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

