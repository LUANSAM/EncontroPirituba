import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

function normalizeCep(cep: string) {
  return cep.replace(/\D/g, "");
}

Deno.serve(async (req) => {
  try {
    const { cep, profileId, profileType } = await req.json();
    const normalizedCep = normalizeCep(cep ?? "");

    if (!normalizedCep || normalizedCep.length !== 8) {
      return Response.json({ allowed: false, message: "CEP inválido." }, { status: 400 });
    }

    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${normalizedCep}/json/`);
    const viaCepData = await viaCepResponse.json();

    const { data: allowedRanges, error } = await supabase
      .from("allowed_ceps")
      .select("cep_start, cep_end, purpose")
      .eq("purpose", "pirituba_allowlist");

    if (error) {
      throw error;
    }

    const inAllowlist = (allowedRanges ?? []).some((item) => {
      const start = normalizeCep(item.cep_start);
      const end = normalizeCep(item.cep_end || item.cep_start);
      return normalizedCep >= start && normalizedCep <= end;
    });

    if (profileId && profileType && ["professional_profiles", "establishment_profiles"].includes(profileType)) {
      await supabase.from(profileType).update({ approved: false }).eq("id", profileId);
    }

    return Response.json({
      allowed: inAllowlist,
      city: viaCepData.localidade,
      neighborhood: viaCepData.bairro,
      message: inAllowlist
        ? "CEP permitido para fluxo de aprovação."
        : "Somente cadastros da subprefeitura de Pirituba são aceitos no momento.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
