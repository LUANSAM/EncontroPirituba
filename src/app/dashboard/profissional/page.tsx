"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/atoms/Container";
import { ProfessionalContactReleaseTabs } from "@/components/organisms/ProfessionalContactReleaseTabs";
import { supabase } from "@/lib/supabase/client";

type IndicadoresMap = Record<string, unknown>;

interface DashboardData {
  nome: string;
  categorias: string[];
  indicadores: IndicadoresMap;
  avaliacao: number;
  preco: number;
  tokens: number;
  contato: Record<string, unknown>;
  endereco: Record<string, unknown>;
  descricao: string;
  fotos: string[];
  panfleto: string;
  beneficios: string[];
  meiosPagamento: string[];
}

const MAIN_KEYS = new Set(["chamadas", "atendimentos", "visualizacoes", "nAvaliacao", "nPreco"]);

function toIntegerInRange(value: unknown, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  const rounded = Math.round(numeric);
  return Math.min(max, Math.max(min, rounded));
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  return [];
}

function labelFromKey(key: string) {
  const clean = key.replace(/[_-]+/g, " ").trim();
  if (!clean) return "Indicador";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function ensureHttpUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function toWhatsappLink(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}`;
}

function IndicatorCard({ title, value, delay = 0 }: { title: string; value: string | number; delay?: number }) {
  return (
    <article
      className="rounded-lg border bg-gradient-to-br from-blue-50 to-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="text-center text-6xl font-extrabold text-blue-600">{value}</p>
      <p className="mt-3 text-center text-[11px] font-medium uppercase tracking-wider text-gray-500">{title}</p>
    </article>
  );
}

function StarsIndicator({ rating, count = 0, delay = 0 }: { rating: number; count?: number; delay?: number }) {
  const rounded = toIntegerInRange(rating, 0, 5);
  const normalizedCount = Math.max(0, Math.round(count || 0));
  return (
    <article
      className="rounded-lg border bg-gradient-to-br from-yellow-50 to-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-center gap-1" role="img" aria-label={`Avaliação ${rounded} de 5`}>
        {Array.from({ length: 5 }).map((_, index) => {
          const active = index < rounded;
          return (
            <span key={`star-${index + 1}`} className={active ? "text-4xl font-bold text-yellow-500" : "text-4xl font-bold text-gray-300"}>
              ★
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] font-medium uppercase tracking-wider text-gray-500">Avaliação</p>
      <p className="mt-1 text-center text-[10px] text-gray-400">{normalizedCount} avaliações</p>
    </article>
  );
}

function PriceIndicator({ price, count = 0, delay = 0 }: { price: number; count?: number; delay?: number }) {
  const rounded = toIntegerInRange(price, 0, 5);
  const normalizedCount = Math.max(0, Math.round(count || 0));

  const getActiveColor = (position: number) => {
    if (position <= 3) return "text-green-600";
    if (position === 4) return "text-orange-500";
    return "text-red-500";
  };

  return (
    <article
      className="rounded-lg border bg-gradient-to-br from-green-50 to-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-center gap-0.5" role="img" aria-label={`Preço ${rounded} de 5`}>
        {Array.from({ length: 5 }).map((_, index) => {
          const position = index + 1;
          const active = index < rounded;
          return (
            <span key={`price-${position}`} className={active ? `text-4xl font-bold ${getActiveColor(position)}` : "text-4xl font-bold text-gray-300"}>
              $
            </span>
          );
        })}
      </div>
      <p className="mt-3 text-center text-[11px] font-medium uppercase tracking-wider text-gray-500">Preço médio</p>
      <p className="mt-1 text-center text-[10px] text-gray-400">{normalizedCount} avaliações</p>
    </article>
  );
}

function TokensIndicator({ tokens }: { tokens: number }) {
  const normalizedTokens = Math.max(0, Math.round(tokens));
  const [displayTokens, setDisplayTokens] = useState(999);

  useEffect(() => {
    const startValue = 999;
    const endValue = normalizedTokens;
    const duration = 2000;
    const startTime = performance.now();
    let frameId = 0;

    setDisplayTokens(startValue);

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const currentValue = Math.round(startValue + (endValue - startValue) * progress);
      setDisplayTokens(currentValue);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, [normalizedTokens]);

  return (
    <div className="flex items-center gap-1">
      <img
        alt="Moeda de tokens"
        className="h-[120px] w-[120px] object-contain"
        src="/images/moeda/moeda.png"
      />
      <p className="-ml-1 font-mono text-[90px] font-bold leading-none tracking-tight text-blue-900">{displayTokens}</p>
    </div>
  );
}

function AnimatedDescendingNumber({ value, className }: { value: number; className?: string }) {
  const normalizedValue = Math.max(0, Math.round(value));
  const [displayValue, setDisplayValue] = useState(999);

  useEffect(() => {
    const startValue = 999;
    const endValue = normalizedValue;
    const duration = 2000;
    const startTime = performance.now();
    let frameId = 0;

    setDisplayValue(startValue);

    const animate = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const current = Math.round(startValue + (endValue - startValue) * progress);
      setDisplayValue(current);

      if (progress < 1) {
        frameId = requestAnimationFrame(animate);
      }
    };

    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [normalizedValue]);

  return <p className={className}>{displayValue}</p>;
}

export default function DashboardProfissionalPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [zoomPhotoIndex, setZoomPhotoIndex] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOrigin, setDragOrigin] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user?.email) {
        router.replace("/");
        return;
      }

      const { data, error: queryError } = await supabase
        .from("usuarios")
        .select("nome, categorias, indicadores, avaliacao, preco, tokens, contato, endereco, descricao, fotos, panfleto, beneficios, meios_pagamento")
        .eq("email", user.email)
        .eq("role", "profissional")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!mounted) return;

      if (queryError || !data || data.length === 0) {
        router.replace("/");
        return;
      }

      const row = data[0] as Record<string, unknown>;
      setDashboardData({
        nome: (row.nome as string) || "Profissional",
        categorias: toStringArray(row.categorias).slice(0, 3),
        indicadores: (row.indicadores as IndicadoresMap) || {},
        avaliacao: toNumber(row.avaliacao, 0),
        preco: toNumber(row.preco, 0),
        tokens: toNumber(row.tokens, 0),
        contato: (row.contato as Record<string, unknown>) || {},
        endereco: (row.endereco as Record<string, unknown>) || {},
        descricao: (row.descricao as string) || "",
        fotos: toStringArray(row.fotos),
        panfleto: (row.panfleto as string) || "",
        beneficios: toStringArray(row.beneficios),
        meiosPagamento: toStringArray(row.meios_pagamento),
      });
      setIsLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const mainIndicators = useMemo(() => {
    const indicadores = dashboardData?.indicadores || {};
    return {
      chamadas: toNumber(indicadores.chamadas, 0),
      atendimentos: toNumber(indicadores.atendimentos, 0),
      visualizacoes: toNumber(indicadores.visualizacoes, 0),
      nAvaliacao: toNumber(indicadores.nAvaliacao, 0),
      nPreco: toNumber(indicadores.nPreco, 0),
    };
  }, [dashboardData]);

  const extraIndicators = useMemo(() => {
    const indicadores = dashboardData?.indicadores || {};
    return Object.entries(indicadores).filter(([key]) => !MAIN_KEYS.has(key));
  }, [dashboardData]);

  const contactWhatsapp = String(dashboardData?.contato?.whatsapp || "").trim();
  const contactInstagram = String(dashboardData?.contato?.instagram || "").trim();
  const contactSite = String(dashboardData?.contato?.site || "").trim();
  const whatsappLink = toWhatsappLink(contactWhatsapp);
  const instagramLink = ensureHttpUrl(contactInstagram);
  const siteLink = ensureHttpUrl(contactSite);

  const logradouro = String(dashboardData?.endereco?.logradouro || "").trim();
  const numero = String(dashboardData?.endereco?.numero || "").trim();
  const bairro = String(dashboardData?.endereco?.bairro || "").trim();
  const cidade = String(dashboardData?.endereco?.cidade || "").trim();
  const uf = String(dashboardData?.endereco?.uf || "").trim();

  const enderecoLinha1 = [logradouro, numero].filter(Boolean).join(" - ");
  const enderecoLinha2 = bairro || [cidade, uf].filter(Boolean).join(" • ");
  const enderecoCompleto = [logradouro, numero, bairro, cidade, uf].filter(Boolean).join(", ");
  const mapsLink = enderecoCompleto
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`
    : "";

  const enderecoTexto = [
    dashboardData?.endereco?.logradouro,
    dashboardData?.endereco?.numero,
    dashboardData?.endereco?.bairro,
    dashboardData?.endereco?.cidade,
    dashboardData?.endereco?.uf,
  ]
    .filter(Boolean)
    .map((part) => String(part))
    .join(" • ");

  useEffect(() => {
    const totalFotos = dashboardData?.fotos.length || 0;
    if (totalFotos === 0) {
      setCarouselIndex(0);
      setZoomPhotoIndex(null);
      return;
    }

    if (carouselIndex >= totalFotos) {
      setCarouselIndex(0);
    }
  }, [dashboardData?.fotos.length, carouselIndex]);

  const ratingPreview = toIntegerInRange(dashboardData?.avaliacao, 0, 5);
  const pricePreview = toIntegerInRange(dashboardData?.preco, 0, 5);
  const activePhoto = dashboardData?.fotos[carouselIndex] || "";
  const zoomPhoto = zoomPhotoIndex !== null ? dashboardData?.fotos[zoomPhotoIndex] || "" : "";

  const goNextPhoto = () => {
    if (!dashboardData?.fotos.length) return;
    setCarouselIndex((prev) => (prev + 1) % dashboardData.fotos.length);
  };

  const goPrevPhoto = () => {
    if (!dashboardData?.fotos.length) return;
    setCarouselIndex((prev) => (prev - 1 + dashboardData.fotos.length) % dashboardData.fotos.length);
  };

  const openZoom = (index: number) => {
    setZoomPhotoIndex(index);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
  };

  const closeZoom = () => {
    setZoomPhotoIndex(null);
    setZoomLevel(1);
    setPan({ x: 0, y: 0 });
    setIsDragging(false);
  };

  return (
    <main className="py-8">
      <Container>
        {previewMode && (
          <section className="mb-3 rounded-lg bg-red-600 px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="flex-1 text-center text-sm font-semibold text-white">
                Visualização de cliente ativa: esta é a forma como os clientes veem seu perfil.
              </p>
              <button
                className="ml-3 rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-blue-900 transition hover:bg-gray-100"
                onClick={() => setPreviewMode(false)}
                type="button"
              >
                Dash
              </button>
            </div>
          </section>
        )}

        {!previewMode && (
          <section className="rounded-lg border bg-white p-4 shadow">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-xl font-bold text-blue-900">Dashboard do Profissional</h1>
                <p className="mt-1 text-sm text-graytext">Indicadores e visão pública do seu perfil.</p>
              </div>
              <button
                className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
                onClick={() => setPreviewMode(true)}
                type="button"
              >
                Ver perfil como cliente
              </button>
            </div>
          </section>
        )}

        {!previewMode && dashboardData && (
          <div className="mt-4 space-y-2">
            <TokensIndicator tokens={dashboardData.tokens} />
            <button
              className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
              onClick={() => router.push("/tokens")}
              type="button"
            >
              Comprar tokens via Pix
            </button>
          </div>
        )}

        {isLoading && (
          <section className="mt-4 rounded-lg border bg-white p-4 shadow-sm">
            <p className="text-sm text-graytext">Carregando indicadores...</p>
          </section>
        )}

        {error && (
          <section className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm">
            <p className="text-sm text-red-700">{error}</p>
          </section>
        )}

        {!isLoading && !error && dashboardData && (
          <div className="mt-4 space-y-4 transition-all duration-300">
            {!previewMode && (
              <>
                <section className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                  <IndicatorCard title="Número de chamadas" value={mainIndicators.chamadas} delay={40} />
                  <IndicatorCard title="Número de atendimentos" value={mainIndicators.atendimentos} delay={80} />
                  <IndicatorCard title="Visualizações do perfil" value={mainIndicators.visualizacoes} delay={120} />
                  <StarsIndicator rating={dashboardData.avaliacao} count={mainIndicators.nAvaliacao} delay={160} />
                  <PriceIndicator price={dashboardData.preco} count={mainIndicators.nPreco} delay={200} />
                </section>

                {extraIndicators.length > 0 && (
                  <section className="rounded-lg border bg-white p-3 shadow-sm">
                    <h2 className="text-xs font-semibold uppercase tracking-wide text-blue-900">Outros indicadores</h2>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {extraIndicators.map(([key, value], index) => (
                        <IndicatorCard
                          key={key}
                          title={labelFromKey(key)}
                          value={typeof value === "number" ? value : String(value)}
                          delay={280 + index * 30}
                        />
                      ))}
                    </div>
                  </section>
                )}

                <ProfessionalContactReleaseTabs />
              </>
            )}

            {previewMode && (
              <section className="rounded-lg border bg-white p-4 shadow transition-all duration-300">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold text-blue-900">{dashboardData.nome}</h2>
                  <div className="text-right text-xs text-graytext">
                    <p className="flex items-center justify-end gap-0.5">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span key={`preview-star-${index + 1}`} className={index < ratingPreview ? "text-base text-yellow-500" : "text-base text-gray-300"}>
                          ★
                        </span>
                      ))}
                    </p>
                    <p className="mt-0.5 flex items-center justify-end gap-0.5">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <span key={`preview-price-${index + 1}`} className={index < pricePreview ? "text-base text-green-700" : "text-base text-gray-300"}>
                          $
                        </span>
                      ))}
                    </p>
                  </div>
                </div>

                {dashboardData.descricao && <p className="mt-3 text-sm leading-relaxed text-graytext">{dashboardData.descricao}</p>}

                {dashboardData.categorias.length > 0 && (
                  <div className="mt-3 rounded-lg border bg-blue-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Categorias de atuação</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {dashboardData.categorias.map((categoria) => (
                        <span key={categoria} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-900">
                          {categoria}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <article className="rounded-lg border bg-blue-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Contato</p>
                    <div className="mt-2 space-y-1.5">
                      {whatsappLink ? (
                        <a className="flex items-center gap-2 text-sm text-graytext hover:text-blue-900" href={whatsappLink} rel="noreferrer" target="_blank">
                          <svg className="h-4 w-4 text-green-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20.52 3.48A11.84 11.84 0 0 0 12.06 0C5.62 0 .39 5.22.39 11.66c0 2.06.54 4.07 1.56 5.84L0 24l6.69-1.75a11.6 11.6 0 0 0 5.37 1.29h.01c6.44 0 11.67-5.22 11.67-11.66 0-3.12-1.21-6.05-3.22-8.4Zm-8.46 18.09h-.01a9.67 9.67 0 0 1-4.92-1.34l-.35-.2-3.97 1.04 1.06-3.87-.23-.4a9.66 9.66 0 0 1-1.49-5.14c0-5.33 4.34-9.67 9.69-9.67 2.58 0 5.01 1 6.83 2.83a9.6 9.6 0 0 1 2.83 6.84c0 5.33-4.35 9.67-9.44 9.9Zm5.3-7.23c-.29-.14-1.72-.85-1.99-.94-.27-.1-.46-.14-.65.14-.2.28-.75.94-.93 1.13-.17.2-.35.21-.64.07-.29-.15-1.25-.46-2.38-1.47a8.94 8.94 0 0 1-1.65-2.04c-.17-.29-.02-.45.12-.6.13-.13.29-.35.44-.52.14-.17.19-.28.29-.47.1-.2.05-.37-.02-.52-.08-.14-.65-1.58-.9-2.16-.23-.56-.47-.48-.65-.49h-.56c-.2 0-.52.07-.8.36-.27.29-1.04 1.02-1.04 2.5s1.06 2.9 1.2 3.1c.15.2 2.08 3.18 5.04 4.46.7.3 1.25.49 1.67.63.7.22 1.34.19 1.85.12.56-.08 1.72-.7 1.96-1.38.24-.69.24-1.28.17-1.4-.08-.13-.27-.2-.56-.34Z" />
                          </svg>
                          <span>{contactWhatsapp}</span>
                        </a>
                      ) : (
                        <p className="flex items-center gap-2 text-sm text-graytext">
                          <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20.52 3.48A11.84 11.84 0 0 0 12.06 0C5.62 0 .39 5.22.39 11.66c0 2.06.54 4.07 1.56 5.84L0 24l6.69-1.75a11.6 11.6 0 0 0 5.37 1.29h.01c6.44 0 11.67-5.22 11.67-11.66 0-3.12-1.21-6.05-3.22-8.4Z" />
                          </svg>
                          <span>Não informado</span>
                        </p>
                      )}

                      {instagramLink ? (
                        <a className="flex items-center gap-2 text-sm text-graytext hover:text-blue-900" href={instagramLink} rel="noreferrer" target="_blank">
                          <svg className="h-4 w-4 text-pink-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Zm8.5 1.8h-8.5A3.95 3.95 0 0 0 3.8 7.75v8.5a3.95 3.95 0 0 0 3.95 3.95h8.5a3.95 3.95 0 0 0 3.95-3.95v-8.5a3.95 3.95 0 0 0-3.95-3.95ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 1.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4Zm5.35-2.22a1.17 1.17 0 1 1 0 2.34 1.17 1.17 0 0 1 0-2.34Z" />
                          </svg>
                          <span>{contactInstagram}</span>
                        </a>
                      ) : (
                        <p className="flex items-center gap-2 text-sm text-graytext">
                          <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M7.75 2h8.5A5.75 5.75 0 0 1 22 7.75v8.5A5.75 5.75 0 0 1 16.25 22h-8.5A5.75 5.75 0 0 1 2 16.25v-8.5A5.75 5.75 0 0 1 7.75 2Z" />
                          </svg>
                          <span>Não informado</span>
                        </p>
                      )}

                      {siteLink ? (
                        <a className="flex items-center gap-2 text-sm text-graytext hover:text-blue-900" href={siteLink} rel="noreferrer" target="_blank">
                          <svg className="h-4 w-4 text-blue-700" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M3 12h18M12 3c2.7 2.2 4.2 5.7 4.2 9S14.7 18.8 12 21M12 3c-2.7 2.2-4.2 5.7-4.2 9S9.3 18.8 12 21" />
                          </svg>
                          <span>{contactSite}</span>
                        </a>
                      ) : (
                        <p className="flex items-center gap-2 text-sm text-graytext">
                          <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="9" />
                          </svg>
                          <span>Não informado</span>
                        </p>
                      )}
                    </div>
                  </article>

                  <article className="rounded-lg border bg-blue-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Endereço</p>
                    {mapsLink ? (
                      <a className="mt-2 flex items-start gap-2 text-sm text-graytext hover:text-blue-900" href={mapsLink} rel="noreferrer" target="_blank">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2c-4.14 0-7.5 3.24-7.5 7.25 0 5.4 6.65 11.88 6.93 12.15a.82.82 0 0 0 1.14 0c.28-.27 6.93-6.75 6.93-12.15C19.5 5.24 16.14 2 12 2Zm0 10.3a3.05 3.05 0 1 1 0-6.1 3.05 3.05 0 0 1 0 6.1Z" />
                        </svg>
                        <span>
                          <span className="block">{enderecoLinha1 || enderecoTexto || "Não informado"}</span>
                          <span className="block">{enderecoLinha2 || ""}</span>
                        </span>
                      </a>
                    ) : (
                      <p className="mt-2 flex items-start gap-2 text-sm text-graytext">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-600" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2c-4.14 0-7.5 3.24-7.5 7.25 0 5.4 6.65 11.88 6.93 12.15a.82.82 0 0 0 1.14 0c.28-.27 6.93-6.75 6.93-12.15C19.5 5.24 16.14 2 12 2Z" />
                        </svg>
                        <span>
                          <span className="block">Não informado</span>
                        </span>
                      </p>
                    )}
                  </article>
                </div>

                {(dashboardData.meiosPagamento.length > 0 || dashboardData.beneficios.length > 0) && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <article className="rounded-lg border bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Meios de pagamento</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {dashboardData.meiosPagamento.length === 0 ? (
                          <span className="text-sm text-graytext">Não informado</span>
                        ) : (
                          dashboardData.meiosPagamento.map((item) => (
                            <span key={item} className="rounded-full border px-2 py-1 text-xs text-blue-900">
                              {item}
                            </span>
                          ))
                        )}
                      </div>
                    </article>

                    <article className="rounded-lg border bg-white p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Benefícios</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {dashboardData.beneficios.length === 0 ? (
                          <span className="text-sm text-graytext">Não informado</span>
                        ) : (
                          dashboardData.beneficios.map((item) => (
                            <span key={item} className="rounded-full border px-2 py-1 text-xs text-blue-900">
                              {item}
                            </span>
                          ))
                        )}
                      </div>
                    </article>
                  </div>
                )}

                <div className="mt-3 grid gap-3 min-[600px]:grid-cols-2">
                  <article className="rounded-lg border bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Fotos</p>

                    {dashboardData.fotos.length > 0 ? (
                      <>
                        <div className="relative mt-2 overflow-hidden rounded-lg border bg-gray-50">
                          <button
                            className="block w-full"
                            onClick={() => openZoom(carouselIndex)}
                            type="button"
                          >
                            <img alt={`Foto do perfil ${carouselIndex + 1}`} className="h-56 w-full object-cover" src={activePhoto} />
                          </button>

                          {dashboardData.fotos.length > 1 && (
                            <>
                              <button
                                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2 py-1 text-sm font-semibold text-blue-900"
                                onClick={goPrevPhoto}
                                type="button"
                              >
                                ‹
                              </button>
                              <button
                                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 px-2 py-1 text-sm font-semibold text-blue-900"
                                onClick={goNextPhoto}
                                type="button"
                              >
                                ›
                              </button>
                            </>
                          )}
                        </div>

                        {dashboardData.fotos.length > 1 && (
                          <div className="mt-2 flex items-center justify-center gap-1.5">
                            {dashboardData.fotos.map((foto, index) => (
                              <button
                                key={`${foto}-${index}`}
                                aria-label={`Ir para foto ${index + 1}`}
                                className={
                                  carouselIndex === index
                                    ? "h-2.5 w-2.5 rounded-full bg-blue-700"
                                    : "h-2.5 w-2.5 rounded-full bg-gray-300"
                                }
                                onClick={() => setCarouselIndex(index)}
                                type="button"
                              />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-graytext">Sem fotos cadastradas.</p>
                    )}
                  </article>

                  <article className="rounded-lg border bg-white p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Catálogo</p>
                    {dashboardData.panfleto ? (
                      <>
                        <iframe
                          className="mt-2 h-56 w-full rounded-lg border"
                          src={`${dashboardData.panfleto}#page=1&view=FitH`}
                          title="Preview do catálogo"
                        />
                        <a className="mt-2 inline-block text-sm font-semibold text-blue-900 underline" href={dashboardData.panfleto} rel="noreferrer" target="_blank">
                          Abrir catálogo completo
                        </a>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-graytext">Catálogo não informado.</p>
                    )}
                  </article>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-[clamp(0.35rem,1.2vw,0.5rem)]">
                  <div className="flex items-center gap-[clamp(0.35rem,1.2vw,0.5rem)]">
                    <img
                      alt="Ícone de avaliações"
                      className="h-[clamp(88px,24vw,150px)] w-[clamp(88px,24vw,150px)] rounded-md object-contain"
                      src="/images/objetivos/avaliacoes.jpg"
                    />
                    <div className="min-w-0">
                      <p className="text-[clamp(0.7rem,2vw,0.95rem)] font-bold text-blue-900">Avaliações</p>
                      <AnimatedDescendingNumber
                        className="whitespace-nowrap font-mono text-[clamp(0.95rem,4.2vw,1.7rem)] font-bold leading-tight text-blue-900"
                        value={Math.max(0, Math.round(mainIndicators.nAvaliacao || 0))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-[clamp(0.35rem,1.2vw,0.5rem)]">
                    <img
                      alt="Ícone de atendimentos"
                      className="h-[clamp(88px,24vw,150px)] w-[clamp(88px,24vw,150px)] rounded-md object-contain"
                      src="/images/objetivos/atendimentos.jpg"
                    />
                    <div className="min-w-0">
                      <p className="text-[clamp(0.7rem,2vw,0.95rem)] font-bold text-blue-900">Atendimentos</p>
                      <AnimatedDescendingNumber
                        className="whitespace-nowrap font-mono text-[clamp(0.95rem,4.2vw,1.7rem)] font-bold leading-tight text-blue-900"
                        value={Math.max(0, Math.round(mainIndicators.atendimentos || 0))}
                      />
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        )}

        {previewMode && zoomPhoto && (
          <div className="fixed inset-0 z-50 bg-black/80 p-4" onMouseMove={(event) => {
            if (!isDragging) return;
            setPan({ x: event.clientX - dragOrigin.x, y: event.clientY - dragOrigin.y });
          }} onMouseUp={() => setIsDragging(false)}>
            <div className="mx-auto flex h-full max-w-5xl flex-col gap-3">
              <div className="flex items-center justify-end gap-2">
                <button
                  className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-blue-900"
                  onClick={() => setZoomLevel((prev) => Math.max(1, prev - 0.2))}
                  type="button"
                >
                  -
                </button>
                <button
                  className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-blue-900"
                  onClick={() => setZoomLevel((prev) => Math.min(4, prev + 0.2))}
                  type="button"
                >
                  +
                </button>
                <button
                  className="rounded-lg bg-white px-3 py-1 text-sm font-semibold text-blue-900"
                  onClick={closeZoom}
                  type="button"
                >
                  Fechar
                </button>
              </div>

              <div className="relative flex-1 overflow-hidden rounded-lg bg-black/40" onMouseLeave={() => setIsDragging(false)}>
                <img
                  alt="Foto ampliada"
                  className="h-full w-full cursor-grab select-none object-contain"
                  draggable={false}
                  onMouseDown={(event) => {
                    setIsDragging(true);
                    setDragOrigin({ x: event.clientX - pan.x, y: event.clientY - pan.y });
                  }}
                  src={zoomPhoto}
                  style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})` }}
                />
              </div>
            </div>
          </div>
        )}
      </Container>
    </main>
  );
}
