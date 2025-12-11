'use client';

import Image from 'next/image';
import { User } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeMap = {
  xs: { container: 'w-6 h-6', icon: 'w-3 h-3' },
  sm: { container: 'w-8 h-8', icon: 'w-4 h-4' },
  md: { container: 'w-10 h-10', icon: 'w-5 h-5' },
  lg: { container: 'w-12 h-12', icon: 'w-6 h-6' },
  xl: { container: 'w-16 h-16', icon: 'w-8 h-8' },
};

const pixelSize = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
};

export default function Avatar({ src, alt, size = 'md', className = '' }: AvatarProps) {
  const { container, icon } = sizeMap[size];

  if (src) {
    return (
      <div className={`relative ${container} rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 ${className}`}>
        <Image
          src={src}
          alt={alt}
          width={pixelSize[size]}
          height={pixelSize[size]}
          className="object-cover w-full h-full"
        />
      </div>
    );
  }

  return (
    <div className={`${container} rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}>
      <User className={`${icon} text-gray-500 dark:text-gray-400`} />
    </div>
  );
}
