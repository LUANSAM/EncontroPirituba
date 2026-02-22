"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type UserRole = "cliente" | "profissional" | "estabelecimento";
type PurchaseStatus = "idle" | "creating" | "pending" | "approved" | "cancelled" | "expired" | "error";

type Plan = {
  id: string;
  name: string;
  price: number;
  tokens: number;
  rsPerCoin: string;
  benefits: string[];
  taxes: string;
  tone: string;
  accent: string;
};

const PLANS: Plan[] = [
  {
    id: "essencial",
    name: "ESSENCIAL",
    price: 25,
    tokens: 25,
    rsPerCoin: "1,00",
    benefits: [],
    taxes: "Cliente solicita contato: 3 moedas\nProfissional escolhe serviço: 5 moedas",
    tone: "bg-slate-50 border-slate-300",
    accent: "text-slate-800",
  },
  {
    id: "pro",
    name: "PRO",
    price: 60,
    tokens: 75,
    rsPerCoin: "0,80",
    benefits: [],
    taxes: "Cliente solicita contato: 3 moedas\nProfissional escolhe serviço: 5 moedas",
    tone: "bg-blue-50 border-blue-300",
    accent: "text-blue-900",
  },
  {
    id: "vip",
    name: "VIP",
    price: 100,
    tokens: 150,
    rsPerCoin: "0,67",
    benefits: ["Ser listado nas indicações do sistema", "Aparecer no destaque de sua categoria"],
    taxes: "Cliente solicita contato: 2 moedas\nProfissional escolhe serviço: 4 moedas",
    tone: "bg-amber-50 border-amber-300",
    accent: "text-amber-800",
  },
  {
    id: "pirituba",
    name: "PIRITUBA",
    price: 150,
    tokens: 300,
    rsPerCoin: "0,50",
    benefits: [
      "Ser listado nas indicações do sistema",
      "Aparecer no destaque na página inicial",
      "Aparecer no destaque de sua categoria",
      "Participar da opção \"Me surpreenda\"",
    ],
    taxes: "Cliente solicita contato: 2 moedas\nProfissional escolhe serviço: 4 moedas",
    tone: "bg-emerald-50 border-emerald-300",
    accent: "text-emerald-800",
  },
];

function dashboardPathByRole(role: UserRole | null) {
  if (role === "profissional") return "/dashboard/profissional";
  if (role === "estabelecimento") return "/dashboard/estabelecimento";
  return "/dashboard/cliente";
}

export default function TokensPage() {
  const router = useRouter();
  const [role, setRole] = useState<UserRole | null>(null);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [purchaseId, setPurchaseId] = useState("");
  const [pixQrCodeBase64, setPixQrCodeBase64] = useState("");
  const [pixQrCodeText, setPixQrCodeText] = useState("");
  const [pixTicketUrl, setPixTicketUrl] = useState("");
  const [status, setStatus] = useState<PurchaseStatus>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [currentTokens, setCurrentTokens] = useState(0);

  const selectedPlan = useMemo(() => PLANS.find((plan) => plan.id === selectedPlanId) || null, [selectedPlanId]);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user?.email) {
        router.replace("/auth");
        return;
      }

      const { data, error: loadError } = await supabase
        .from("usuarios")
        .select("role, tokens")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!mounted) return;

      if (loadError || !data || data.length === 0) {
        setError("Não foi possível carregar seu perfil para compra de tokens.");
        setIsBootLoading(false);
        return;
      }

      const userRole = String((data[0] as { role?: unknown }).role || "") as UserRole;
      const tokens = Number((data[0] as { tokens?: unknown }).tokens || 0);

      setRole(userRole);
      setCurrentTokens(Number.isFinite(tokens) ? tokens : 0);
      setIsBootLoading(false);

      if (userRole !== "profissional" && userRole !== "estabelecimento") {
        router.replace(dashboardPathByRole(userRole));
      }
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (!purchaseId || status !== "pending") return;

    let cancelled = false;

    const poll = async () => {
      const { data, error: invokeError } = await supabase.functions.invoke("check_token_purchase_status", {
        body: { purchaseId },
      });

      if (cancelled) return;

      if (invokeError) {
        setStatusMessage("Pagamento criado. Aguardando confirmação automática do Pix em segundo plano...");
        return;
      }

      const responseStatus = String(data?.status || "pending");

      if (responseStatus === "approved") {
        setStatus("approved");
        const newBalance = Number(data?.newBalance || 0);
        if (Number.isFinite(newBalance) && newBalance >= 0) {
          setCurrentTokens(newBalance);
        }
        setStatusMessage("Pagamento confirmado! Seus tokens foram creditados com sucesso.");
        setTimeout(() => {
          router.replace(dashboardPathByRole(role));
        }, 1800);
        return;
      }

      if (responseStatus === "cancelled") {
        setStatus("cancelled");
        setStatusMessage("Pagamento cancelado ou rejeitado. Se desejar, inicie uma nova compra.");
        return;
      }

      if (responseStatus === "expired") {
        setStatus("expired");
        setStatusMessage("O QR Code expirou. Se desejar, inicie uma nova compra.");
        return;
      }

      setStatus("pending");
      setStatusMessage("Aguardando confirmação do Pix... não atualize esta tela.");
    };

    poll();
    const interval = setInterval(poll, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [purchaseId, role, router, status]);

  const startPurchase = async (planId: string) => {
    setError("");
    setStatus("creating");
    setStatusMessage("Criando cobrança Pix...");
    setSelectedPlanId(planId);

    // Verificar se o usuário está autenticado
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setStatus("error");
      setStatusMessage("");
      setError("Sessão expirada. Por favor, faça login novamente.");
      setTimeout(() => router.replace("/auth"), 2000);
      return;
    }

    const { data, error: invokeError } = await supabase.functions.invoke("create_token_purchase", {
      body: { planId },
    });

    if (invokeError) {
      setStatus("error");
      setStatusMessage("");
      setError("Não foi possível iniciar a cobrança Pix agora. Tente novamente.");
      return;
    }

    const nextPurchaseId = String(data?.purchaseId || "");
    const qrCodeBase64 = String(data?.qrCodeBase64 || "");
    const qrCode = String(data?.qrCode || "");

    if (!nextPurchaseId || (!qrCodeBase64 && !qrCode)) {
      setStatus("error");
      setStatusMessage("");
      setError("A cobrança foi iniciada, mas os dados Pix não foram retornados corretamente.");
      return;
    }

    setPurchaseId(nextPurchaseId);
    setPixQrCodeBase64(qrCodeBase64);
    setPixQrCodeText(qrCode);
    setPixTicketUrl(String(data?.ticketUrl || ""));
    setStatus("pending");
    setStatusMessage("Pagamento Pix criado. Não atualize esta tela até a confirmação.");
  };

  const copyPixCode = async () => {
    if (!pixQrCodeText) return;
    try {
      await navigator.clipboard.writeText(pixQrCodeText);
      setStatusMessage("Código Pix copiado. Finalize o pagamento no seu banco e aguarde a confirmação automática.");
    } catch {
      setStatusMessage("Não foi possível copiar automaticamente. Copie manualmente o código Pix.");
    }
  };

  return (
    <main className="py-1">
      <div className="mx-auto w-full max-w-7xl px-1">
        <section className="rounded-lg border bg-white p-3 shadow">
          <div className="flex flex-wrap items-center justify-between gap-0.5">
            <div>
              <h1 className="text-xl font-bold text-blue-900">Compra de tokens via Pix</h1>
              <p className="mt-0.5 text-sm text-graytext">Selecione um plano e conclua a compra com QR Code ou código copia e cola.</p>
            </div>
            <div className="rounded-lg border bg-blue-50 px-2.5 py-1.5 text-sm font-semibold text-blue-900">Saldo atual: {currentTokens} tokens</div>
          </div>

          {isBootLoading && <p className="mt-3 text-sm text-graytext">Carregando dados...</p>}
          {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}

          {!isBootLoading && (
            <>
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-sm font-semibold text-amber-800">
                Não atualize esta tela após iniciar o pagamento. A confirmação roda em segundo plano e o saldo será atualizado automaticamente.
              </p>

              <div className="mt-3 grid gap-3 min-[750px]:grid-cols-2">
                {PLANS.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <article key={plan.id} className={`min-w-[360px] rounded-lg border p-3 shadow-sm ${plan.tone} ${isSelected ? "ring-2 ring-blue-400" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <h2 className={`text-base font-extrabold ${plan.accent}`}>{plan.name}</h2>
                        <button
                          className="rounded-lg bg-blue-900 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60"
                          disabled={status === "creating" || status === "pending"}
                          onClick={() => startPurchase(plan.id)}
                          type="button"
                        >
                          {status === "creating" && isSelected ? "Iniciando..." : "Selecionar"}
                        </button>
                      </div>

                      <div className="mt-2 grid gap-1.5 min-[480px]:grid-cols-3">
                        <div className="rounded border bg-white px-2 py-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Preço</p>
                          <p className="text-sm font-bold text-blue-900">R$ {plan.price.toFixed(2).replace(".", ",")}</p>
                        </div>
                        <div className="rounded border bg-white px-2 py-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Moedas</p>
                          <p className="text-sm font-bold text-blue-900">{plan.tokens}</p>
                        </div>
                        <div className="rounded border bg-white px-2 py-1">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">R$/Moeda</p>
                          <p className="text-sm font-bold text-blue-900">{plan.rsPerCoin}</p>
                        </div>
                        <div className="rounded border bg-white px-2 py-1 min-[480px]:col-span-3">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-500">Custos</p>
                          <p className="text-xs text-gray-700 whitespace-pre-line leading-tight">{plan.taxes}</p>
                        </div>
                      </div>

                      <div className="mt-2 rounded border bg-white p-2">
                        <p className="text-[9px] font-semibold uppercase tracking-wide text-blue-900">Benefícios</p>
                        {plan.benefits.length === 0 ? (
                          <p className="mt-0.5 text-xs text-graytext">Plano sem destaque adicional.</p>
                        ) : (
                          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-gray-700">
                            {plan.benefits.map((benefit) => (
                              <li key={benefit}>{benefit}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
