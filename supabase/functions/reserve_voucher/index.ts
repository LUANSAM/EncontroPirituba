import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  {
    global: {
      headers: { Authorization: "" },
    },
  },
);

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { voucher_id, service_id } = await req.json();
    const authedClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data, error } = await authedClient.rpc("reserve_voucher_atomic", {
      p_voucher_id: voucher_id,
      p_service_id: service_id ?? null,
    });

    if (error) throw error;

    return Response.json({ booking_id: data });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
});
