'use client';

import React from 'react';
import Image from 'next/image';
import { getCardLogo as getCardLogoUrl } from '@/lib/finance-service';

export function CardLogo({ name, size = 'md' }: { name: string, size?: 'sm' | 'md' | 'lg' }) {
  const url = getCardLogoUrl(name);
  const sizeClasses = {
    sm: 'w-6 h-6 rounded-md p-0.5',
    md: 'w-[45px] h-[45px] rounded-xl p-1',
    lg: 'w-14 h-14 rounded-2xl p-1.5'
  };

  return (
    <div className={`${sizeClasses[size]} relative overflow-hidden bg-white border border-slate-100 flex-shrink-0 shadow-sm`}>
      <Image 
        src={url} 
        alt={name} 
        fill 
        className="object-contain" 
        unoptimized 
      />
    </div>
  );
}
