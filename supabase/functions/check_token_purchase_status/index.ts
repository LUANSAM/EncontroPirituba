import { createClient } from "jsr:@supabase/supabase-js@2";

const cancellableStatuses = new Set(["cancelled", "rejected", "refunded", "charged_back"]);
const pendingStatuses = new Set(["pending", "in_process", "authorized"]);

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

    if (authError || !user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await req.json();
    const purchaseId = String(body?.purchaseId || "");

    if (!purchaseId) {
      return Response.json({ error: "Missing purchase id." }, { status: 400, headers: corsHeaders });
    }

    const { data: purchaseRows, error: purchaseError } = await serviceClient
      .from("token_purchases")
      .select("id, user_id, usuario_id, status, tokens_amount, tokens_credited, mp_payment_id, pix_expires_at, approved_at")
      .eq("id", purchaseId)
      .limit(1);

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

    if (purchase.user_id !== user.id) {
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

    if (!mpResponse.ok) {
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

    return Response.json(
      {
        status: "pending",
        purchaseId,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400, headers: corsHeaders });
  }
});