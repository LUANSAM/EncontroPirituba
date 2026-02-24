"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/atoms/Container";
import { supabase } from "@/lib/supabase/client";

type DashboardTab = "profissionais" | "estabelecimentos";

interface UsuarioCard {
  id: string;
  nome: string;
  role: "profissional" | "estabelecimento";
  plano: string;
  categorias: string[];
  descricao: string;
  indicadores: Record<string, unknown>;
  endereco: Record<string, unknown>;
}

interface RecentReview {
  id: string;
  rating: number;
  comment: string;
  target_type: string;
  created_at: string;
}

function getPlano(plano: string) {
  return String(plano || "").toUpperCase();
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

function enderecoResumo(endereco: Record<string, unknown>) {
  const bairro = String(endereco?.bairro || "").trim();
  const cidade = String(endereco?.cidade || "").trim();
  if (bairro && cidade) return `${bairro} • ${cidade}`;
  return bairro || cidade || "Pirituba";
}

export default function DashboardClientePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const [tab, setTab] = useState<DashboardTab>("profissionais");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const [allUsuarios, setAllUsuarios] = useState<UsuarioCard[]>([]);
  const [featuredUsuarios, setFeaturedUsuarios] = useState<UsuarioCard[]>([]);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);

  const [serviceCategory, setServiceCategory] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceUrgency, setServiceUrgency] = useState("normal");
  const [creatingServiceRequest, setCreatingServiceRequest] = useState(false);

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

      const { data: profileRows, error: profileError } = await supabase
        .from("usuarios")
        .select("role")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1);

      if (profileError || !profileRows || profileRows.length === 0) {
        router.replace("/");
        return;
      }

      if (profileRows[0].role !== "cliente") {
        router.replace("/");
        return;
      }

      const [usuariosResult, reviewsResult] = await Promise.all([
        supabase
          .from("usuarios")
          .select("id, nome, role, plano, categorias, descricao, indicadores, endereco")
          .in("role", ["profissional", "estabelecimento"])
          .order("created_at", { ascending: false }),
        supabase.rpc("get_recent_reviews", { p_limit: 8 }),
      ]);

      if (!mounted) return;

      if (usuariosResult.error) {
        setError("Não foi possível carregar profissionais e estabelecimentos.");
        setLoading(false);
        return;
      }

      const parsedUsuarios = ((usuariosResult.data || []) as Record<string, unknown>[]).map((row) => ({
        id: String(row.id || ""),
        nome: String(row.nome || "Sem nome"),
        role: String(row.role || "profissional") as "profissional" | "estabelecimento",
        plano: String(row.plano || ""),
        categorias: toStringArray(row.categorias),
        descricao: String(row.descricao || ""),
        indicadores: (row.indicadores as Record<string, unknown>) || {},
        endereco: (row.endereco as Record<string, unknown>) || {},
      }));

      const featured = parsedUsuarios.filter((item) => {
        const planoIndicador = getPlano(item.plano);
        if (planoIndicador === "VIP" || planoIndicador === "PIRITUBA") return true;
        return false;
      });
      const featuredMap = new Map<string, UsuarioCard>();
      featured.forEach((item) => featuredMap.set(item.id, item));

      setAllUsuarios(parsedUsuarios);
      setFeaturedUsuarios(Array.from(featuredMap.values()));
      setRecentReviews(((reviewsResult.data as RecentReview[] | null) || []).slice(0, 8));
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  const categoryOptions = useMemo(() => {
    const all = new Set<string>();
    allUsuarios.forEach((usuario) => {
      usuario.categorias.forEach((category) => {
        if (category) all.add(category);
      });
    });
    return Array.from(all).sort((first, second) => first.localeCompare(second));
  }, [allUsuarios]);

  const filteredUsuarios = useMemo(() => {
    const targetRole = tab === "profissionais" ? "profissional" : "estabelecimento";
    const term = searchTerm.trim().toLowerCase();
    return allUsuarios.filter((usuario) => {
      if (usuario.role !== targetRole) return false;

      if (selectedCategories.length > 0) {
        const matchesCategory = selectedCategories.every((category) => usuario.categorias.includes(category));
        if (!matchesCategory) return false;
      }

      if (term && !usuario.nome.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [allUsuarios, searchTerm, selectedCategories, tab]);

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) => (prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]));
  };

  const createServiceRequest = async () => {
    setStatusMessage("");
    setError("");

    if (!serviceCategory || !serviceTitle.trim() || !serviceDescription.trim()) {
      setError("Preencha categoria, título e descrição para solicitar o serviço.");
      return;
    }

    setCreatingServiceRequest(true);

    const { data, error: rpcError } = await supabase.rpc("create_service_request", {
      p_category: serviceCategory,
      p_title: serviceTitle.trim(),
      p_description: serviceDescription.trim(),
      p_urgency: serviceUrgency,
    });

    setCreatingServiceRequest(false);

    if (rpcError || !data) {
      setError(rpcError?.message || "Não foi possível criar a solicitação de serviço.");
      return;
    }

    setStatusMessage("Solicitação de serviço criada com sucesso. Em breve você poderá acompanhar as respostas.");
    setServiceCategory("");
    setServiceTitle("");
    setServiceDescription("");
    setServiceUrgency("normal");
  };

  return (
    <main className="py-8">
      <Container>
        <section className="rounded-lg border bg-white p-5 shadow">
          <h1 className="text-2xl font-bold text-blue-900">Dashboard do Cliente</h1>
          <p className="mt-1 text-sm text-graytext">Descubra profissionais, estabelecimentos e peça serviços com filtros rápidos.</p>
        </section>

        {loading && <p className="mt-4 rounded-lg border bg-white p-4 text-sm text-graytext">Carregando dados do cliente...</p>}
        {error && <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
        {statusMessage && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700">{statusMessage}</p>}

        {!loading && !error && (
          <div className="mt-4 space-y-4">
            <section className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-blue-900">Indicações</h2>
              <p className="mt-1 text-xs text-graytext">Profissionais e estabelecimentos com plano VIP ou Pirituba.</p>
              {featuredUsuarios.length === 0 ? (
                <p className="mt-3 text-sm text-graytext">Ainda não há indicações disponíveis.</p>
              ) : (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {featuredUsuarios.map((item) => {
                    const href = item.role === "profissional" ? `/profissional/${item.id}` : `/estabelecimento/${item.id}`;
                    return (
                      <Link className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 transition hover:border-blue-300" href={href} key={`featured-${item.id}`}>
                        <p className="text-sm font-semibold text-blue-900">{item.nome}</p>
                        <p className="text-xs text-graytext">{item.role === "profissional" ? "Profissional" : "Estabelecimento"} • {enderecoResumo(item.endereco)}</p>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-blue-900">Avaliações recentes</h2>
              {recentReviews.length === 0 ? (
                <p className="mt-2 text-sm text-graytext">Nenhuma avaliação recente encontrada.</p>
              ) : (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {recentReviews.map((review) => (
                    <article className="rounded-lg border bg-gray-50 p-3" key={review.id}>
                      <p className="text-sm font-semibold text-blue-900">{review.target_type === "professional" ? "Profissional" : "Estabelecimento"}</p>
                      <p className="mt-0.5 text-xs text-graytext">Nota: {review.rating}/5</p>
                      <p className="mt-1 text-sm text-gray-700">{review.comment || "Sem comentário."}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-lg border bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-blue-900">Explorar por categoria</h2>
                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
                  <button
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tab === "profissionais" ? "bg-white text-blue-900 shadow" : "text-gray-600"}`}
                    onClick={() => setTab("profissionais")}
                    type="button"
                  >
                    Profissionais
                  </button>
                  <button
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold ${tab === "estabelecimentos" ? "bg-white text-blue-900 shadow" : "text-gray-600"}`}
                    onClick={() => setTab("estabelecimentos")}
                    type="button"
                  >
                    Estabelecimentos
                  </button>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-lg border px-3 py-2 text-sm"
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Pesquisar por nome"
                  value={searchTerm}
                />
                <button
                  className="rounded-lg border px-3 py-2 text-sm font-semibold text-blue-900"
                  onClick={() => setSelectedCategories([])}
                  type="button"
                >
                  Limpar filtros ({selectedCategories.length})
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {categoryOptions.map((category) => {
                  const selected = selectedCategories.includes(category);
                  return (
                    <button
                      className={selected ? "rounded-full border border-blue-900 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-900" : "rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-700"}
                      key={category}
                      onClick={() => toggleCategory(category)}
                      type="button"
                    >
                      {category}
                    </button>
                  );
                })}
              </div>

              {filteredUsuarios.length === 0 ? (
                <p className="mt-3 text-sm text-graytext">Nenhum resultado encontrado para os filtros atuais.</p>
              ) : (
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {filteredUsuarios.map((item) => {
                    const href = item.role === "profissional" ? `/profissional/${item.id}` : `/estabelecimento/${item.id}`;
                    return (
                      <Link className="rounded-lg border bg-white p-3 transition hover:border-blue-200" href={href} key={`item-${item.id}`}>
                        <p className="text-sm font-semibold text-blue-900">{item.nome}</p>
                        <p className="mt-0.5 text-xs text-graytext">{enderecoResumo(item.endereco)}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-gray-700">{item.descricao || "Sem descrição cadastrada."}</p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {item.categorias.slice(0, 4).map((category) => (
                            <span className="rounded-full border border-blue-100 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-900" key={`${item.id}-${category}`}>
                              {category}
                            </span>
                          ))}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-lg border bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-blue-900">Solicitar serviço</h2>
              <p className="mt-1 text-xs text-graytext">Descreva o que precisa sem envio de fotos.</p>
              <div className="mt-3 grid gap-2">
                <select className="rounded-lg border px-3 py-2 text-sm" onChange={(event) => setServiceCategory(event.target.value)} value={serviceCategory}>
                  <option value="">Selecione a categoria</option>
                  {categoryOptions.map((category) => (
                    <option key={`service-category-${category}`} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <input
                  className="rounded-lg border px-3 py-2 text-sm"
                  onChange={(event) => setServiceTitle(event.target.value)}
                  placeholder="Título da solicitação"
                  value={serviceTitle}
                />
                <textarea
                  className="min-h-[110px] rounded-lg border px-3 py-2 text-sm"
                  onChange={(event) => setServiceDescription(event.target.value)}
                  placeholder="Descreva sua necessidade"
                  value={serviceDescription}
                />
                <select className="rounded-lg border px-3 py-2 text-sm" onChange={(event) => setServiceUrgency(event.target.value)} value={serviceUrgency}>
                  <option value="baixa">Urgência baixa</option>
                  <option value="normal">Urgência normal</option>
                  <option value="alta">Urgência alta</option>
                  <option value="urgente">Urgência urgente</option>
                </select>
                <button
                  className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={creatingServiceRequest}
                  onClick={() => {
                    void createServiceRequest();
                  }}
                  type="button"
                >
                  {creatingServiceRequest ? "Enviando..." : "Solicitar serviço"}
                </button>
              </div>
            </section>
          </div>
        )}
      </Container>
    </main>
  );
}
