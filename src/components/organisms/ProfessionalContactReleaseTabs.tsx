"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type RequestStatus = "pending" | "authorized" | "denied" | "insufficient_tokens" | "cancelled";
type RequestedByRole = "cliente" | "profissional";
type ActiveTab = "sent" | "received";

const WEB_PUSH_PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY || "";

interface ContactReleaseRequest {
  id: string;
  status: RequestStatus;
  requested_by_role: RequestedByRole;
  requested_at: string;
  responded_at: string | null;
  authorized_at: string | null;
  debited_tokens: number | null;
  request_note: string | null;
  response_note: string | null;
  requester_email: string;
  requester_name: string | null;
  target_email: string;
  target_name: string | null;
}

function toUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

function toBase64Url(value: ArrayBuffer | null) {
  if (!value) return "";
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((item) => {
    binary += String.fromCharCode(item);
  });
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const statusLabel: Record<RequestStatus, string> = {
  pending: "Pendente",
  authorized: "Autorizada",
  denied: "Recusada",
  insufficient_tokens: "Sem saldo",
  cancelled: "Cancelada",
};

const statusClass: Record<RequestStatus, string> = {
  pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
  authorized: "bg-green-50 text-green-700 border-green-200",
  denied: "bg-red-50 text-red-700 border-red-200",
  insufficient_tokens: "bg-orange-50 text-orange-700 border-orange-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function RequestRow({
  item,
  isReceived,
  actionInProgress,
  onAuthorize,
  onDeny,
}: {
  item: ContactReleaseRequest;
  isReceived: boolean;
  actionInProgress: boolean;
  onAuthorize: (requestId: string) => void;
  onDeny: (requestId: string) => void;
}) {
  const canRespond = isReceived && item.status === "pending";

  return (
    <article className="rounded-lg border bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-blue-900">{isReceived ? item.requester_name || item.requester_email : item.target_name || item.target_email}</p>
          <p className="text-xs text-graytext">
            {isReceived ? "Cliente solicitou seu contato" : "Solicitação iniciada por você"}
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass[item.status]}`}>{statusLabel[item.status]}</span>
      </div>

      <div className="mt-2 grid gap-1 text-xs text-graytext sm:grid-cols-2">
        <p>Pedido: {formatDate(item.requested_at)}</p>
        <p>Resposta: {formatDate(item.responded_at)}</p>
        {item.authorized_at ? <p>Autorização: {formatDate(item.authorized_at)}</p> : <p>Autorização: -</p>}
        {item.debited_tokens ? <p>Moedas debitadas: {item.debited_tokens}</p> : <p>Moedas debitadas: -</p>}
      </div>

      {item.request_note && (
        <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-2 text-xs text-blue-900">
          <p className="font-semibold">Mensagem do pedido</p>
          <p className="mt-0.5 whitespace-pre-wrap">{item.request_note}</p>
        </div>
      )}

      {item.response_note && (
        <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 py-2 text-xs text-gray-700">
          <p className="font-semibold">Observação da resposta</p>
          <p className="mt-0.5 whitespace-pre-wrap">{item.response_note}</p>
        </div>
      )}

      {canRespond && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            className="rounded-lg bg-blue-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionInProgress}
            onClick={() => onAuthorize(item.id)}
            type="button"
          >
            Autorizar contato
          </button>
          <button
            className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={actionInProgress}
            onClick={() => onDeny(item.id)}
            type="button"
          >
            Recusar
          </button>
        </div>
      )}
    </article>
  );
}

export function ProfessionalContactReleaseTabs() {
  const [tab, setTab] = useState<ActiveTab>("sent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [pushReady, setPushReady] = useState(false);
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);
  const [sentRequests, setSentRequests] = useState<ContactReleaseRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<ContactReleaseRequest[]>([]);

  const registerPushSubscription = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (!WEB_PUSH_PUBLIC_KEY) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) return;

    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toUint8Array(WEB_PUSH_PUBLIC_KEY),
      });
    }

    const payload = {
      p_endpoint: subscription.endpoint,
      p_p256dh: toBase64Url(subscription.getKey("p256dh")),
      p_auth: toBase64Url(subscription.getKey("auth")),
      p_user_agent: navigator.userAgent,
    };

    const { error: upsertError } = await supabase.rpc("upsert_browser_push_subscription", payload);
    if (upsertError) {
      setError("Não foi possível registrar notificações em segundo plano neste navegador.");
      return;
    }

    setPushReady(true);
  }, []);

  const showContactRequestNotification = useCallback((request: Pick<ContactReleaseRequest, "requester_name" | "requester_email" | "request_note">) => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const requester = request.requester_name || request.requester_email || "Cliente";
    const body = request.request_note
      ? `${requester} solicitou liberação de contato. Mensagem: ${request.request_note}`
      : `${requester} solicitou liberação de contato.`;

    const notification = new Notification("Nova solicitação de contato", {
      body,
      icon: "/images/logo/encontro-pirituba-logo.png",
      tag: "contact-release-request",
    });

    notification.onclick = () => {
      window.focus();
      setTab("received");
    };
  }, []);

  const enableBrowserNotifications = useCallback(async () => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === "denied") {
      setError("Notificações do navegador estão bloqueadas. Libere no navegador para receber alertas em tempo real.");
      return;
    }

    if (permission === "granted") {
      setStatusMessage("Notificações do navegador ativadas para novas solicitações de contato.");
      await registerPushSubscription();
    }
  }, [registerPushSubscription]);

  const loadRequests = useCallback(async () => {
    setError("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.id) {
      setError("Não foi possível identificar o profissional logado.");
      setLoading(false);
      return;
    }

    const [sentResult, receivedResult] = await Promise.all([
      supabase
        .from("contact_access_requests")
        .select(
          "id, status, requested_by_role, requested_at, responded_at, authorized_at, debited_tokens, request_note, response_note, requester_email, requester_name, target_email, target_name"
        )
        .eq("professional_user_id", user.id)
        .eq("requested_by_role", "profissional")
        .order("requested_at", { ascending: false }),
      supabase
        .from("contact_access_requests")
        .select(
          "id, status, requested_by_role, requested_at, responded_at, authorized_at, debited_tokens, request_note, response_note, requester_email, requester_name, target_email, target_name"
        )
        .eq("professional_user_id", user.id)
        .eq("requested_by_role", "cliente")
        .order("requested_at", { ascending: false }),
    ]);

    if (sentResult.error || receivedResult.error) {
      setError("Não foi possível carregar as solicitações de liberação de contato.");
      setLoading(false);
      return;
    }

    setSentRequests((sentResult.data || []) as ContactReleaseRequest[]);
    setReceivedRequests((receivedResult.data || []) as ContactReleaseRequest[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const support = typeof Notification !== "undefined";
    setNotificationsSupported(support);

    if (!support) return;
    setNotificationPermission(Notification.permission);

    if (Notification.permission === "granted") {
      void registerPushSubscription();
    }
  }, [registerPushSubscription]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) return;

      channel = supabase
        .channel(`contact-release-notify-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "contact_access_requests",
            filter: `professional_user_id=eq.${user.id}`,
          },
          (payload) => {
            const inserted = payload.new as ContactReleaseRequest;
            if (inserted.requested_by_role !== "cliente") return;

            setReceivedRequests((prev) => {
              if (prev.some((item) => item.id === inserted.id)) return prev;
              return [inserted, ...prev];
            });

            setStatusMessage("Você recebeu uma nova solicitação de liberação de contato.");
            showContactRequestNotification(inserted);
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [showContactRequestNotification]);

  const activeList = useMemo(() => (tab === "sent" ? sentRequests : receivedRequests), [tab, sentRequests, receivedRequests]);

  const resolveRequest = async (requestId: string, authorize: boolean) => {
    setStatusMessage("");
    setError("");
    setActionRequestId(requestId);

    const { data, error: rpcError } = await supabase.rpc("authorize_contact_access_request", {
      p_request_id: requestId,
      p_authorize: authorize,
      p_response_note: null,
    });

    if (rpcError) {
      setError(rpcError.message || "Não foi possível atualizar a solicitação.");
      setActionRequestId(null);
      return;
    }

    const payload = (data || {}) as { message?: string; status?: string };
    setStatusMessage(payload.message || (authorize ? "Contato autorizado com sucesso." : "Solicitação recusada com sucesso."));

    await loadRequests();
    setActionRequestId(null);
  };

  return (
    <section className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-blue-900">Liberação de contato</h2>
          <p className="text-xs text-graytext">Acompanhe pedidos enviados e solicitações recebidas de clientes.</p>
          {notificationsSupported && notificationPermission !== "granted" && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-xs text-graytext">Ative notificações do navegador para ser avisado no momento em que um cliente solicitar contato.</p>
              <button
                className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-900 transition hover:bg-blue-100"
                onClick={() => {
                  void enableBrowserNotifications();
                }}
                type="button"
              >
                Ativar notificações
              </button>
            </div>
          )}
          {notificationsSupported && notificationPermission === "granted" && pushReady && (
            <p className="mt-2 text-xs text-green-700">Notificações em primeiro e segundo plano ativas neste navegador.</p>
          )}
          {notificationsSupported && notificationPermission === "granted" && !WEB_PUSH_PUBLIC_KEY && (
            <p className="mt-2 text-xs text-amber-700">Falta configurar NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY para notificação com navegador fechado.</p>
          )}
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === "sent" ? "bg-white text-blue-900 shadow" : "text-gray-600 hover:text-blue-900"
            }`}
            onClick={() => setTab("sent")}
            type="button"
          >
            Pedidos escolhidos ({sentRequests.length})
          </button>
          <button
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
              tab === "received" ? "bg-white text-blue-900 shadow" : "text-gray-600 hover:text-blue-900"
            }`}
            onClick={() => setTab("received")}
            type="button"
          >
            Solicitações recebidas ({receivedRequests.length})
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">{statusMessage}</div>
      )}

      {error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="mt-3 text-sm text-graytext">Carregando solicitações...</p>
      ) : activeList.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-6 text-center text-sm text-graytext">
          {tab === "sent"
            ? "Você ainda não possui pedidos de liberação iniciados por você."
            : "Você ainda não recebeu pedidos de liberação de contato de clientes."}
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {activeList.map((item) => (
            <RequestRow
              key={item.id}
              actionInProgress={actionRequestId === item.id}
              isReceived={tab === "received"}
              item={item}
              onAuthorize={(id) => {
                void resolveRequest(id, true);
              }}
              onDeny={(id) => {
                void resolveRequest(id, false);
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}
