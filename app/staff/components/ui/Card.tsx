// app/staff/components/ui/Card.tsx
"use client";

import { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  border?: boolean;
  hover?: boolean;
}

export default function Card({ 
  children, 
  className = "", 
  padded = true, 
  border = true,
  hover = false 
}: CardProps) {
  return (
    <div 
      className={`
        bg-neutral-950 
        ${border ? 'border border-neutral-900' : ''} 
        ${padded ? 'p-6' : ''} 
        rounded-2xl 
        transition-all
        ${hover ? 'hover:border-red-600/50 hover:shadow-lg hover:shadow-red-900/10' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
