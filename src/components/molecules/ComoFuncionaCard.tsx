"use client";

import Image from "next/image";
import { useState } from "react";

interface ComoFuncionaCardProps {
  title: string;
  subtitle: string;
  image: string;
}

export function ComoFuncionaCard({ title, subtitle, image }: ComoFuncionaCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow">
      <div className="relative h-16 w-full bg-gradient-to-br from-green-100 to-orange-100 sm:h-20 md:h-24">
        {!imageError && (
          <Image
            fill
            alt={title}
            className="object-cover"
            src={image}
            sizes="(max-width: 768px) 100vw, 33vw"
            onError={() => setImageError(true)}
          />
        )}
      </div>
      <div className="p-2 sm:p-3 md:p-4">
        <h3 className="text-sm font-bold text-green-700 sm:text-base">{title}</h3>
        <p className="mt-1 text-xs text-graytext sm:text-sm">{subtitle}</p>
      </div>
    </div>
  );
}
