import { createClient } from "jsr:@supabase/supabase-js@2";

const cancellableStatuses = new Set(["cancelled", "rejected", "refunded", "charged_back"]);
const pendingStatuses = new Set(["pending", "in_process", "authorized"]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function parseJwtClaims(token: string): { sub: string | null; email: string | null; exp: number | null } {
  try {
    const tokenParts = token.split(".");
    if (tokenParts.length < 2) return { sub: null, email: null, exp: null };

    const payloadBase64 = tokenParts[1].replace(/-/g, "+").replace(/_/g, "/");
    const paddedPayload = payloadBase64.padEnd(Math.ceil(payloadBase64.length / 4) * 4, "=");
    const payloadJson = atob(paddedPayload);
    const payload = JSON.parse(payloadJson) as { sub?: string; email?: string; exp?: number };

    return {
      sub: typeof payload.sub === "string" ? payload.sub : null,
      email: typeof payload.email === "string" ? payload.email : null,
      exp: typeof payload.exp === "number" ? payload.exp : null,
    };
  } catch {
    return { sub: null, email: null, exp: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const traceId = crypto.randomUUID().slice(0, 8);
  const log = (step: string, payload?: Record<string, unknown>) => {
    console.log(`[check_token_purchase_status][${traceId}] ${step}`, payload ?? {});
  };

  try {
    log("request_received", {
      method: req.method,
      url: req.url,
      hasAuthorizationHeader: Boolean(req.headers.get("authorization") ?? req.headers.get("Authorization")),
      hasApikeyHeader: Boolean(req.headers.get("apikey")),
      clientInfo: req.headers.get("x-client-info") ?? null,
    });

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") ?? "";

    log("env_check", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(supabaseServiceRoleKey),
      hasMercadoPagoToken: Boolean(mercadoPagoAccessToken),
    });

    if (!supabaseUrl || !supabaseServiceRoleKey || !mercadoPagoAccessToken) {
      log("missing_env_configuration");
      return Response.json({ error: "Missing payment environment configuration." }, { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    log("auth_header_parsed", {
      authHeaderPresent: Boolean(authHeader),
      tokenLength: accessToken.length,
      tokenPrefix: accessToken ? accessToken.slice(0, 12) : null,
    });

    if (!accessToken) {
      log("unauthorized_missing_token");
      return Response.json({ error: "Unauthorized", reason: "missing_authorization_header" }, { status: 401, headers: corsHeaders });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await serviceClient.auth.getUser(accessToken);

    const claims = parseJwtClaims(accessToken);
    const claimSub = claims.sub;
    const claimEmail = claims.email;
    const claimExp = claims.exp;
    const isClaimExpired = typeof claimExp === "number" && claimExp * 1000 < Date.now();

    log("auth_get_user_result", {
      authError: authError?.message ?? null,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      claimSub,
      claimEmail,
      claimExp,
      isClaimExpired,
    });

    const authUserId = user?.id ?? claimSub;

    if (!authUserId || isClaimExpired) {
      log("unauthorized_invalid_token", {
        authError: authError?.message ?? null,
        hasUser: Boolean(user),
        hasClaimSub: Boolean(claimSub),
        isClaimExpired,
      });
      return Response.json(
        {
          error: "Unauthorized",
          reason: "invalid_or_expired_token",
          details: authError?.message ?? null,
        },
        { status: 401, headers: corsHeaders },
      );
    }

    const body = await req.json();
    const purchaseId = String(body?.purchaseId || "");

    log("purchase_id_validation", {
      purchaseId,
      hasPurchaseId: Boolean(purchaseId),
    });

    if (!purchaseId) {
      return Response.json({ error: "Missing purchase id." }, { status: 400, headers: corsHeaders });
    }

    const { data: purchaseRows, error: purchaseError } = await serviceClient
      .from("token_purchases")
      .select("id, user_id, usuario_id, status, tokens_amount, tokens_credited, mp_payment_id, pix_expires_at, approved_at")
      .eq("id", purchaseId)
      .limit(1);

    log("purchase_lookup", {
      purchaseError: purchaseError?.message ?? null,
      purchaseCount: purchaseRows?.length ?? 0,
    });

    if (purchaseError || !purchaseRows || purchaseRows.length === 0) {
      return Response.json({ error: "Purchase not found." }, { status: 404, headers: corsHeaders });
    }

    const purchase = purchaseRows[0] as {
      id: string;
      user_id: string;
      usuario_id: string;
      status: string;
      tokens_amount: number;
      tokens_credited: boolean;
      mp_payment_id?: string;
      pix_expires_at?: string;
      approved_at?: string;
    };

    if (purchase.user_id !== authUserId) {
      log("forbidden_purchase_owner_mismatch", {
        purchaseUserId: purchase.user_id,
        authUserId,
      });
      return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }

    if (purchase.status === "approved" && purchase.tokens_credited) {
      const { data: usuarioRows } = await serviceClient
        .from("usuarios")
        .select("tokens")
        .eq("id", purchase.usuario_id)
        .limit(1);

      return Response.json(
        {
          status: "approved",
          purchaseId,
          newBalance: Number((usuarioRows?.[0] as { tokens?: unknown } | undefined)?.tokens || 0),
          approvedAt: purchase.approved_at || null,
        },
        { headers: corsHeaders },
      );
    }

    if (!purchase.mp_payment_id) {
      return Response.json({ error: "PIX payment id is missing for this purchase." }, { status: 400, headers: corsHeaders });
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${purchase.mp_payment_id}`, {
      headers: {
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
      },
    });

    const mpData = await mpResponse.json();

    log("mercado_pago_status_response", {
      ok: mpResponse.ok,
      status: mpResponse.status,
      mpStatus: mpData?.status ?? null,
      mpStatusDetail: mpData?.status_detail ?? null,
    });

    if (!mpResponse.ok) {
      log("mercado_pago_status_failed", { status: mpResponse.status });
      return Response.json({ error: "Could not fetch payment status from Mercado Pago.", details: mpData }, { status: 400, headers: corsHeaders });
    }

    const mpStatus = String(mpData?.status || "pending");
    const mpStatusDetail = String(mpData?.status_detail || "");

    let normalizedStatus: "pending" | "approved" | "cancelled" | "expired" = "pending";
    if (mpStatus === "approved") {
      normalizedStatus = "approved";
    } else if (cancellableStatuses.has(mpStatus)) {
      normalizedStatus = "cancelled";
    } else if (pendingStatuses.has(mpStatus)) {
      normalizedStatus = "pending";
    }

    if (normalizedStatus === "pending" && purchase.pix_expires_at) {
      const expiresAt = new Date(purchase.pix_expires_at).getTime();
      if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
        normalizedStatus = "expired";
      }
    }

    const nowIso = new Date().toISOString();

    if (normalizedStatus === "approved") {
      await serviceClient
        .from("token_purchases")
        .update({
          status: "approved",
          mp_status: mpStatus,
          mp_status_detail: mpStatusDetail,
          approved_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", purchaseId);

      const { data: creditRows, error: creditError } = await serviceClient
        .from("token_purchases")
        .update({
          tokens_credited: true,
          tokens_credited_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", purchaseId)
        .eq("tokens_credited", false)
        .select("tokens_amount, usuario_id")
        .limit(1);

      if (creditError) {
        return Response.json({ error: "Payment approved but token credit failed." }, { status: 500, headers: corsHeaders });
      }

      if (creditRows && creditRows.length > 0) {
        const creditRow = creditRows[0] as { tokens_amount?: number; usuario_id?: string };
        const tokensToAdd = Number(creditRow.tokens_amount || 0);

        const { data: usuarioRows, error: usuarioReadError } = await serviceClient
          .from("usuarios")
          .select("tokens")
          .eq("id", String(creditRow.usuario_id || ""))
          .limit(1);

        if (usuarioReadError || !usuarioRows || usuarioRows.length === 0) {
          return Response.json({ error: "Tokens approved but profile record was not found." }, { status: 500, headers: corsHeaders });
        }

        const currentBalance = Number((usuarioRows[0] as { tokens?: unknown }).tokens || 0);
        const newBalance = currentBalance + tokensToAdd;

        const { error: usuarioUpdateError } = await serviceClient
          .from("usuarios")
          .update({ tokens: newBalance })
          .eq("id", String(creditRow.usuario_id || ""));

        if (usuarioUpdateError) {
          return Response.json({ error: "Payment approved but tokens were not added to user balance." }, { status: 500, headers: corsHeaders });
        }
      }

      const { data: updatedUsuarioRows } = await serviceClient
        .from("usuarios")
        .select("tokens")
        .eq("id", purchase.usuario_id)
        .limit(1);

      return Response.json(
        {
          status: "approved",
          purchaseId,
          newBalance: Number((updatedUsuarioRows?.[0] as { tokens?: unknown } | undefined)?.tokens || 0),
          approvedAt: nowIso,
        },
        { headers: corsHeaders },
      );
    }

    if (normalizedStatus === "cancelled" || normalizedStatus === "expired") {
      await serviceClient
        .from("token_purchases")
        .update({
          status: normalizedStatus,
          mp_status: mpStatus,
          mp_status_detail: mpStatusDetail,
          updated_at: nowIso,
        })
        .eq("id", purchaseId);

      return Response.json(
        {
          status: normalizedStatus,
          purchaseId,
        },
        { headers: corsHeaders },
      );
    }

    await serviceClient
      .from("token_purchases")
      .update({
        status: "pending",
        mp_status: mpStatus,
        mp_status_detail: mpStatusDetail,
        updated_at: nowIso,
      })
      .eq("id", purchaseId);

    log("request_success_pending", { purchaseId });
    return Response.json(
      {
        status: "pending",
        purchaseId,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error(`[check_token_purchase_status][${traceId}] unhandled_error`, {
      message: (error as Error).message,
      stack: (error as Error).stack ?? null,
    });
    return Response.json({ error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});