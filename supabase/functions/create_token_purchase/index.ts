import { createClient } from "jsr:@supabase/supabase-js@2";

type PlanConfig = {
  id: string;
  name: string;
  amount: number;
  tokens: number;
  rsPerCoin: number;
};

const PLANS: Record<string, PlanConfig> = {
  essencial: { id: "essencial", name: "ESSENCIAL", amount: 25, tokens: 25, rsPerCoin: 1 },
  pro: { id: "pro", name: "PRO", amount: 60, tokens: 75, rsPerCoin: 0.8 },
  vip: { id: "vip", name: "VIP", amount: 100, tokens: 150, rsPerCoin: 0.67 },
  pirituba: { id: "pirituba", name: "PIRITUBA", amount: 150, tokens: 300, rsPerCoin: 0.5 },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const traceId = crypto.randomUUID().slice(0, 8);
  const log = (step: string, payload?: Record<string, unknown>) => {
    console.log(`[create_token_purchase][${traceId}] ${step}`, payload ?? {});
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
    const notificationUrl = Deno.env.get("MERCADO_PAGO_NOTIFICATION_URL") ?? "";
    const isTestToken = mercadoPagoAccessToken.startsWith("TEST-");

    log("env_check", {
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasServiceRoleKey: Boolean(supabaseServiceRoleKey),
      hasMercadoPagoToken: Boolean(mercadoPagoAccessToken),
      mercadoPagoTokenMode: isTestToken ? "test" : "live_or_unknown",
      hasNotificationUrl: Boolean(notificationUrl),
    });

    if (!supabaseUrl || !supabaseServiceRoleKey || !mercadoPagoAccessToken) {
      log("missing_env_configuration");
      return Response.json({ error: "Missing payment environment configuration." }, { status: 500, headers: corsHeaders });
    }

    if (isTestToken) {
      log("mercado_pago_test_token_blocked");
      return Response.json(
        {
          error: "Mercado Pago token is in TEST mode. Use production APP_USR token for real Pix payments.",
          reason: "mercado_pago_test_mode",
        },
        { status: 400, headers: corsHeaders },
      );
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

    log("auth_get_user_result", {
      authError: authError?.message ?? null,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
    });

    if (authError || !user?.id || !user.email) {
      log("unauthorized_invalid_token", {
        authError: authError?.message ?? null,
        hasUser: Boolean(user),
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
    const planId = String(body?.planId || "").toLowerCase();
    const plan = PLANS[planId];

    log("plan_validation", {
      planId,
      isValidPlan: Boolean(plan),
    });

    if (!plan) {
      return Response.json({ error: "Invalid plan selected." }, { status: 400, headers: corsHeaders });
    }

    const { data: usuarioRows, error: usuarioError } = await serviceClient
      .from("usuarios")
      .select("id, role, email")
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .limit(1);

    log("profile_lookup", {
      email: user.email,
      profileCount: usuarioRows?.length ?? 0,
      profileError: usuarioError?.message ?? null,
    });

    if (usuarioError || !usuarioRows || usuarioRows.length === 0) {
      return Response.json({ error: "User profile not found." }, { status: 404, headers: corsHeaders });
    }

    const usuario = usuarioRows[0] as { id?: string; role?: string; email?: string };
    const role = String(usuario.role || "");

    log("role_validation", {
      role,
      allowed: role === "profissional" || role === "estabelecimento",
    });

    if (role !== "profissional" && role !== "estabelecimento") {
      return Response.json({ error: "Only professionals and establishments can buy tokens." }, { status: 403, headers: corsHeaders });
    }

    const { data: purchaseRows, error: insertError } = await serviceClient
      .from("token_purchases")
      .insert({
        user_id: user.id,
        usuario_id: String(usuario.id || ""),
        user_email: user.email,
        role,
        plan_id: plan.id,
        plan_name: plan.name,
        tokens_amount: plan.tokens,
        amount: plan.amount,
        rs_per_coin: plan.rsPerCoin,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .limit(1);

    log("purchase_insert", {
      insertError: insertError?.message ?? null,
      insertedRows: purchaseRows?.length ?? 0,
    });

    if (insertError || !purchaseRows || purchaseRows.length === 0) {
      return Response.json({ error: "Could not create purchase record." }, { status: 400, headers: corsHeaders });
    }

    const purchaseId = String((purchaseRows[0] as { id?: string }).id || "");
    if (!purchaseId) {
      return Response.json({ error: "Could not determine purchase id." }, { status: 500, headers: corsHeaders });
    }

    const paymentPayload: Record<string, unknown> = {
      transaction_amount: plan.amount,
      description: `Compra de ${plan.tokens} tokens - Plano ${plan.name}`,
      payment_method_id: "pix",
      payer: {
        email: user.email,
      },
      external_reference: purchaseId,
      metadata: {
        purchase_id: purchaseId,
        user_id: user.id,
        plan_id: plan.id,
        tokens: plan.tokens,
      },
    };

    if (notificationUrl) paymentPayload.notification_url = notificationUrl;

    log("mercado_pago_create_payment_request", {
      purchaseId,
      planId: plan.id,
      amount: plan.amount,
      hasMercadoPagoToken: Boolean(mercadoPagoAccessToken),
    });

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${mercadoPagoAccessToken}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": purchaseId,
      },
      body: JSON.stringify(paymentPayload),
    });

    const mpData = await mpResponse.json();

    log("mercado_pago_create_payment_response", {
      ok: mpResponse.ok,
      status: mpResponse.status,
      mpId: mpData?.id ?? null,
      mpLiveMode: mpData?.live_mode ?? null,
      mpStatus: mpData?.status ?? null,
      mpStatusDetail: mpData?.status_detail ?? null,
    });

    if (!mpResponse.ok) {
      await serviceClient
        .from("token_purchases")
        .update({
          status: "failed",
          mp_status: String(mpData?.status || "failed"),
          mp_status_detail: JSON.stringify(mpData),
          updated_at: new Date().toISOString(),
        })
        .eq("id", purchaseId);

      log("mercado_pago_create_payment_failed", {
        status: mpResponse.status,
      });

      return Response.json({ error: "Mercado Pago rejected payment creation.", details: mpData }, { status: 400, headers: corsHeaders });
    }

    const transactionData = mpData?.point_of_interaction?.transaction_data ?? {};
    const qrCode = String(transactionData?.qr_code || "");
    const qrCodeBase64 = String(transactionData?.qr_code_base64 || "");
    const ticketUrl = String(transactionData?.ticket_url || "");
    const expiresAt = mpData?.date_of_expiration ? String(mpData.date_of_expiration) : null;

    const { error: updateError } = await serviceClient
      .from("token_purchases")
      .update({
        mp_payment_id: String(mpData?.id || ""),
        mp_status: String(mpData?.status || "pending"),
        mp_status_detail: String(mpData?.status_detail || ""),
        pix_qr_code: qrCode,
        pix_qr_code_base64: qrCodeBase64,
        pix_ticket_url: ticketUrl,
        pix_expires_at: expiresAt,
        status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchaseId);

    log("purchase_update_with_pix", {
      updateError: updateError?.message ?? null,
      hasQrCode: Boolean(qrCode),
      hasQrCodeBase64: Boolean(qrCodeBase64),
      hasTicketUrl: Boolean(ticketUrl),
    });

    if (updateError) {
      return Response.json({ error: "Payment created but failed to persist PIX data." }, { status: 500, headers: corsHeaders });
    }

    log("request_success", { purchaseId });

    return Response.json(
      {
        purchaseId,
        status: "pending",
        qrCode,
        qrCodeBase64,
        ticketUrl,
        expiresAt,
        plan,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error(`[create_token_purchase][${traceId}] unhandled_error`, {
      message: (error as Error).message,
      stack: (error as Error).stack ?? null,
    });
    return Response.json({ error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});