// app/staff/components/ui/Badge.tsx
"use client";

import { ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function Badge({ 
  children, 
  variant = 'default',
  size = 'md',
  className = ""
}: BadgeProps) {
  
  const variantClasses = {
    default: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    success: 'bg-green-950/30 text-green-500 border-green-900',
    warning: 'bg-yellow-950/30 text-yellow-500 border-yellow-900',
    danger: 'bg-red-950/30 text-red-500 border-red-900',
    info: 'bg-blue-950/30 text-blue-500 border-blue-900'
  };

  const sizeClasses = {
    sm: 'text-[8px] px-2 py-0.5',
    md: 'text-[10px] px-3 py-1',
    lg: 'text-xs px-4 py-1.5'
  };

  return (
    <span 
      className={`
        inline-flex items-center justify-center
        font-black uppercase tracking-widest
        border rounded-full
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
