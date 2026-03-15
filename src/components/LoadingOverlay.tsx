import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = 'Loading...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 flex flex-col items-center shadow-xl max-w-sm w-full mx-4">
        <Loader2 className="w-12 h-12 text-lidl-blue-500 animate-spin mb-4" />
        <p className="text-zinc-900 font-medium text-lg text-center">{message}</p>
      </div>
    </div>
  );
}
