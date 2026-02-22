import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

Deno.serve(async (req) => {
  try {
    const method = req.method.toUpperCase();

    if (method === "GET") {
      const { data, error } = await supabase
        .from("allowed_ceps")
        .select("*")
        .eq("purpose", "pirituba_allowlist")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return Response.json(data);
    }

    if (method === "POST") {
      const payload = await req.json();
      const { data, error } = await supabase.from("allowed_ceps").insert(payload).select("*").single();
      if (error) throw error;
      return Response.json(data, { status: 201 });
    }

    return Response.json({ error: "Method not allowed" }, { status: 405 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
});
