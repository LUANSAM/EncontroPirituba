"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Container } from "@/components/atoms/Container";
import { supabase } from "@/lib/supabase/client";

interface EstablishmentData {
  id: string;
  nome: string;
  descricao: string;
  categorias: string[];
  endereco: Record<string, unknown>;
  contato: Record<string, unknown>;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function maskedValue(value: string) {
  if (!value.trim()) return "***";
  return "***";
}

export default function EstablishmentPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const establishmentId = String(params?.id || "");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<EstablishmentData | null>(null);

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

      if (String(profileRows?.[0]?.role || "") !== "cliente") {
        router.replace("/");
        return;
      }

      const { data: establishmentRows, error: establishmentError } = await supabase
        .from("usuarios")
        .select("id, nome, descricao, categorias, endereco, contato")
        .eq("id", establishmentId)
        .eq("role", "estabelecimento")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!mounted) return;

      if (establishmentError || !establishmentRows || establishmentRows.length === 0) {
        setError("Estabelecimento não encontrado.");
        setLoading(false);
        return;
      }

      const row = establishmentRows[0] as Record<string, unknown>;
      setData({
        id: String(row.id || ""),
        nome: String(row.nome || "Estabelecimento"),
        descricao: String(row.descricao || ""),
        categorias: toStringArray(row.categorias),
        endereco: (row.endereco as Record<string, unknown>) || {},
        contato: (row.contato as Record<string, unknown>) || {},
      });

      await supabase.rpc("increment_usuario_profile_visits", { p_usuario_id: establishmentId });
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [establishmentId, router]);

  const enderecoResumo = useMemo(() => {
    const bairro = String(data?.endereco?.bairro || "").trim();
    const cidade = String(data?.endereco?.cidade || "").trim();
    return [bairro, cidade].filter(Boolean).join(" • ") || "Pirituba";
  }, [data]);

  return (
    <main className="py-8">
      <Container>
        {loading && <p className="rounded-lg border bg-white p-4 text-sm text-graytext">Carregando perfil...</p>}
        {error && <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}

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

            <article className="mt-4 rounded-lg border bg-blue-50 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-900">Contato (liberação controlada)</p>
              <p className="mt-2 text-sm text-graytext">WhatsApp: {maskedValue(String(data.contato?.whatsapp || ""))}</p>
              <p className="mt-1 text-sm text-graytext">Instagram: {maskedValue(String(data.contato?.instagram || ""))}</p>
              <p className="mt-1 text-sm text-graytext">Site: {maskedValue(String(data.contato?.site || ""))}</p>
            </article>
          </section>
        )}
      </Container>
    </main>
  );
}
