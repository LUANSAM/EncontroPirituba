"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Container } from "@/components/atoms/Container";
import { supabase } from "@/lib/supabase/client";
import { createContactAccessRequest } from "@/lib/contact-access";

interface ProfessionalData {
  id: string;
  nome: string;
  descricao: string;
  categorias: string[];
  endereco: Record<string, unknown>;
  contato: Record<string, unknown>;
  meios_pagamento: string[];
  beneficios: string[];
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function maskedValue(value: string) {
  if (!value.trim()) return "***";
  return "***";
}

export default function ProfessionalPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const professionalId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [data, setData] = useState<ProfessionalData | null>(null);

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

      const { data: profileRows } = await supabase
        .from("usuarios")
        .select("role")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1);

      const currentRole = String(profileRows?.[0]?.role || "");
      if (currentRole !== "cliente") {
        router.replace("/");
        return;
      }

      const { data: professionalRows, error: professionalError } = await supabase
        .from("usuarios")
        .select("id, nome, descricao, categorias, endereco, contato, meios_pagamento, beneficios")
        .eq("id", professionalId)
        .eq("role", "profissional")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!mounted) return;

      if (professionalError || !professionalRows || professionalRows.length === 0) {
        setError("Profissional não encontrado.");
        setLoading(false);
        return;
      }

      const row = professionalRows[0] as Record<string, unknown>;
      setData({
        id: String(row.id || ""),
        nome: String(row.nome || "Profissional"),
        descricao: String(row.descricao || ""),
        categorias: toStringArray(row.categorias),
        endereco: (row.endereco as Record<string, unknown>) || {},
        contato: (row.contato as Record<string, unknown>) || {},
        meios_pagamento: toStringArray(row.meios_pagamento),
        beneficios: toStringArray(row.beneficios),
      });

      await supabase.rpc("increment_usuario_profile_visits", { p_usuario_id: professionalId });
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [professionalId, router]);

  const enderecoResumo = useMemo(() => {
    const bairro = String(data?.endereco?.bairro || "").trim();
    const cidade = String(data?.endereco?.cidade || "").trim();
    return [bairro, cidade].filter(Boolean).join(" • ") || "Pirituba";
  }, [data]);

  const requestContactRelease = async () => {
    if (!data?.id) return;
    setError("");
    setStatusMessage("");
    setRequestLoading(true);

    try {
      await createContactAccessRequest({
        professionalUserId: data.id,
        requestNote: requestNote.trim(),
      });

      setStatusMessage("Solicitação enviada ao profissional. Você será avisado quando ele autorizar o contato.");
      setRequestNote("");
    } catch (requestError) {
      setError((requestError as Error).message || "Não foi possível enviar a solicitação de contato.");
    } finally {
      setRequestLoading(false);
    }
  };

  return (
    <main className="py-8">
      <Container>
        {loading && <p className="rounded-lg border bg-white p-4 text-sm text-graytext">Carregando perfil...</p>}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {statusMessage && <p className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{statusMessage}</p>}

        {!loading && !error && data && (
          <section className="rounded-lg border bg-white p-4 shadow-sm">
            <h1 className="text-xl font-bold text-blue-900">{data.nome}</h1>
            <p className="mt-1 text-sm text-graytext">{enderecoResumo}</p>

            {data.descricao && <p className="mt-3 text-sm leading-relaxed text-gray-700">{data.descricao}</p>}

            {data.categorias.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.categorias.map((category) => (
                  <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900" key={category}>
                    {category}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <article className="rounded-lg border bg-blue-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Contato</p>
                <p className="mt-2 text-sm text-graytext">WhatsApp: {maskedValue(String(data.contato?.whatsapp || ""))}</p>
                <p className="mt-1 text-sm text-graytext">Instagram: {maskedValue(String(data.contato?.instagram || ""))}</p>
                <p className="mt-1 text-sm text-graytext">Site: {maskedValue(String(data.contato?.site || ""))}</p>
              </article>

              <article className="rounded-lg border bg-white p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Solicitar liberação de contato</p>
                <textarea
                  className="mt-2 min-h-[110px] w-full rounded-lg border px-3 py-2 text-sm"
                  onChange={(event) => setRequestNote(event.target.value)}
                  placeholder="Descreva rapidamente seu interesse (opcional)."
                  value={requestNote}
                />
                <button
                  className="mt-2 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={requestLoading}
                  onClick={() => {
                    void requestContactRelease();
                  }}
                  type="button"
                >
                  {requestLoading ? "Enviando..." : "Solicitar autorização de contato"}
                </button>
              </article>
            </div>

            {(data.meios_pagamento.length > 0 || data.beneficios.length > 0) && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <article className="rounded-lg border bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Meios de pagamento</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {data.meios_pagamento.map((item) => (
                      <span className="rounded-full border px-2 py-1 text-xs text-blue-900" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </article>

                <article className="rounded-lg border bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Benefícios</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {data.beneficios.map((item) => (
                      <span className="rounded-full border px-2 py-1 text-xs text-blue-900" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </article>
              </div>
            )}
          </section>
        )}
      </Container>
    </main>
  );
}
