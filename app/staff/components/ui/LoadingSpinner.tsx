// app/staff/components/ui/LoadingSpinner.tsx
"use client";

import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  text?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ 
  text = "Chargement...", 
  fullScreen = false 
}: LoadingSpinnerProps) {
  
  const content = (
    <div className="flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 text-red-600 animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-500 animate-pulse">
        {text}
      </p>
    </div>
  );

  if (fullScreen) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        {content}
      </main>
    );
  }

  return content;
}
