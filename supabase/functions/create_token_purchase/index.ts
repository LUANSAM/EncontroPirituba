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

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const mercadoPagoAccessToken = Deno.env.get("MERCADO_PAGO_ACCESS_TOKEN") ?? "";
    const notificationUrl = Deno.env.get("MERCADO_PAGO_NOTIFICATION_URL") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !mercadoPagoAccessToken) {
      return Response.json({ error: "Missing payment environment configuration." }, { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const authedClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: authError,
    } = await authedClient.auth.getUser();

    if (authError || !user?.id || !user.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const planId = String(body?.planId || "").toLowerCase();
    const plan = PLANS[planId];

    if (!plan) {
      return Response.json({ error: "Invalid plan selected." }, { status: 400, headers: corsHeaders });
    }

    const { data: usuarioRows, error: usuarioError } = await serviceClient
      .from("usuarios")
      .select("id, role, email")
      .eq("email", user.email)
      .order("created_at", { ascending: false })
      .limit(1);

    if (usuarioError || !usuarioRows || usuarioRows.length === 0) {
      return Response.json({ error: "User profile not found." }, { status: 404, headers: corsHeaders });
    }

    const usuario = usuarioRows[0] as { id?: string; role?: string; email?: string };
    const role = String(usuario.role || "");

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

    if (updateError) {
      return Response.json({ error: "Payment created but failed to persist PIX data." }, { status: 500, headers: corsHeaders });
    }

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
    return Response.json({ error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});