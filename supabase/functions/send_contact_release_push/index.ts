// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

interface SendPushRequestBody {
  professionalUserId: string;
  requestId?: string;
  requesterName?: string;
  requesterEmail?: string;
  requestNote?: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const vapidPublicKey = Deno.env.get("WEB_PUSH_VAPID_PUBLIC_KEY") || "";
const vapidPrivateKey = Deno.env.get("WEB_PUSH_VAPID_PRIVATE_KEY") || "";
const vapidSubject = Deno.env.get("WEB_PUSH_VAPID_SUBJECT") || "mailto:contato@encontropirituba.com.br";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function buildBody(requesterName?: string, requesterEmail?: string, requestNote?: string) {
  const requester = requesterName?.trim() || requesterEmail?.trim() || "Cliente";
  if (requestNote?.trim()) {
    return `${requester} solicitou liberação de contato. Mensagem: ${requestNote.trim()}`;
  }
  return `${requester} solicitou liberação de contato.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing Supabase environment variables." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "Missing WEB_PUSH_VAPID_PUBLIC_KEY/PRIVATE_KEY." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing Bearer token." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jwt = authHeader.replace("Bearer ", "");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: userError,
    } = await supabaseAdmin.auth.getUser(jwt);

    if (userError || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized.", details: userError?.message || null }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as SendPushRequestBody;
    const requestedProfessionalUserId = String(body?.professionalUserId || "").trim();
    const requestId = String(body?.requestId || "").trim();
    let targetProfessionalUserId = requestedProfessionalUserId;

    if (!requestId && !requestedProfessionalUserId) {
      return new Response(JSON.stringify({ error: "professionalUserId or requestId is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (requestId) {
      const { data: requestRow, error: requestError } = await supabaseAdmin
        .from("contact_access_requests")
        .select("id, client_user_id, professional_user_id")
        .eq("id", requestId)
        .eq("requested_by_role", "cliente")
        .limit(1);

      if (requestError || !requestRow || requestRow.length === 0) {
        return new Response(JSON.stringify({ error: "Request not found." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const row = requestRow[0] as { client_user_id?: string; professional_user_id?: string };
      const ownerClientId = String(row.client_user_id || "");
      if (!ownerClientId || ownerClientId !== user.id) {
        return new Response(JSON.stringify({ error: "Authenticated user is not the owner of this contact request." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      targetProfessionalUserId = String(row.professional_user_id || "").trim();
    }

    if (!targetProfessionalUserId) {
      return new Response(JSON.stringify({ error: "Could not resolve professional user for notification." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from("browser_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", targetProfessionalUserId)
      .eq("is_active", true);

    if (subscriptionsError) {
      return new Response(JSON.stringify({ error: subscriptionsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ delivered: 0, failed: 0, inactive: 0, message: "No active subscriptions." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const payload = JSON.stringify({
      title: "Nova solicitação de contato",
      body: buildBody(body.requesterName, body.requesterEmail, body.requestNote),
      url: "/dashboard/profissional",
    });

    let delivered = 0;
    let failed = 0;
    let inactive = 0;

    for (const subscriptionRow of subscriptions) {
      const subscription = {
        endpoint: subscriptionRow.endpoint,
        keys: {
          p256dh: subscriptionRow.p256dh,
          auth: subscriptionRow.auth,
        },
      };

      try {
        await webpush.sendNotification(subscription, payload);
        delivered += 1;
      } catch (error) {
        failed += 1;
        const statusCode = Number((error as { statusCode?: unknown })?.statusCode || 0);

        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin
            .from("browser_push_subscriptions")
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq("id", subscriptionRow.id);
          inactive += 1;
        }
      }
    }

    return new Response(JSON.stringify({ delivered, failed, inactive }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
