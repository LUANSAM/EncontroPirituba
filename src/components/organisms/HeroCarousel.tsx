"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Card } from "@/components/atoms/Card";

const heroMessages = [
  {
    title: "Encontre serviços e ofertas na sua rua",
    subtitle: "Marketplace local para Pirituba e região, com foco em descoberta rápida e confiança.",
  },
  {
    title: "Descubra vouchers locais com economia real",
    subtitle: "Aproveite promoções de estabelecimentos da região em um só lugar.",
  },
  {
    title: "Agende profissionais da região com praticidade",
    subtitle: "Compare opções próximas e escolha com base em avaliações e disponibilidade.",
  },
];

interface HeroCarouselProps {
  bannerImages?: string[];
}

export function HeroCarousel({ bannerImages = [] }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  const hasImages = bannerImages.length > 0;
  const currentMessage = heroMessages[index % heroMessages.length];
  useEffect(() => {
    if (!hasImages) {
      return;
    }

    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % bannerImages.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [bannerImages.length, hasImages]);

  return (
    <Card className="overflow-hidden bg-blue-900 p-0 text-white">
      <div className="px-4 pb-2 pt-2 text-center md:px-6 md:pb-4">
        <div className="relative mx-auto h-56 w-full overflow-hidden rounded-xl border border-white/20 bg-white/10 md:h-80">
          {hasImages ? (
            bannerImages.map((imageSrc, slideIndex) => (
              <div
                key={imageSrc}
                className={`absolute inset-0 transition-opacity duration-700 ${slideIndex === index ? "opacity-100" : "opacity-0"}`}
              >
                <Image
                  fill
                  priority={slideIndex === 0}
                  alt={`Banner ${slideIndex + 1} Encontro Pirituba`}
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 1200px"
                  src={imageSrc}
                  onLoad={() =>
                    setLoadedImages((prev) => ({
                      ...prev,
                      [imageSrc]: true,
                    }))
                  }
                />

                {!loadedImages[imageSrc] && (
                  <div className="absolute inset-0 animate-pulse bg-blue-500/40">
                    <div className="flex h-full items-end p-4">
                      <div className="w-full space-y-2">
                        <div className="h-3 w-2/3 rounded bg-white/40" />
                        <div className="h-3 w-1/2 rounded bg-white/30" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="absolute inset-0 flex animate-pulse items-center justify-center bg-blue-500/30">
              <span className="text-sm font-medium text-white/90">Adicione imagens em public/images/banners</span>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center space-y-1 bg-gradient-to-t from-white/95 to-transparent p-4 pb-6 text-center">
            <span className="inline-flex animate-pulse rounded-full border border-black/30 bg-black/10 px-3 py-0.5 text-xs font-semibold uppercase tracking-wide text-black">
              Pirituba e região
            </span>
            <h1 className="text-lg font-semibold leading-tight text-black md:text-2xl">{currentMessage.title}</h1>
            <p className="mx-auto hidden max-w-2xl text-xs text-black/80 md:block md:text-sm">{currentMessage.subtitle}</p>
          </div>

          {hasImages && (
            <div className="absolute right-3 top-3 flex gap-2">
              <button
                aria-label="Banner anterior"
                className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold transition hover:bg-white/35"
                onClick={() => setIndex((prev) => (prev - 1 + bannerImages.length) % bannerImages.length)}
                type="button"
              >
                ←
              </button>
              <button
                aria-label="Próximo banner"
                className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold transition hover:bg-white/35"
                onClick={() => setIndex((prev) => (prev + 1) % bannerImages.length)}
                type="button"
              >
                →
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 flex justify-center gap-2">
          {hasImages ? (
            bannerImages.map((imageSrc, slideIndex) => (
              <span
                key={imageSrc}
                className={`h-2 w-2 rounded-full ${slideIndex === index ? "bg-white" : "bg-white/50"}`}
              />
            ))
          ) : (
            <span className="h-2 w-2 rounded-full bg-white" />
          )}
        </div>
      </div>
    </Card>
  );
}
