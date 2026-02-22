"use client";

import Image from "next/image";
import { useState } from "react";

interface ObjetivoCardProps {
  title: string;
  description: string;
  image: string;
}

export function ObjetivoCard({ title, description, image }: ObjetivoCardProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div className="overflow-hidden rounded-lg border bg-white shadow">
      <div className="relative h-24 w-full bg-gradient-to-br from-blue-100 to-green-100 sm:h-32 md:h-36 lg:h-40">
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
        <h3 className="text-sm font-bold text-blue-900 sm:text-base">{title}</h3>
        <p className="mt-1 text-xs text-graytext sm:text-sm">{description}</p>
      </div>
    </div>
  );
}
