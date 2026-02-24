import { supabase } from "@/lib/supabase/client";

interface CreateContactAccessRequestInput {
  professionalUserId: string;
  requestNote?: string;
}

interface CreateContactAccessRequestResult {
  requestId: string;
}

export async function createContactAccessRequest(input: CreateContactAccessRequestInput): Promise<CreateContactAccessRequestResult> {
  const professionalUserId = String(input.professionalUserId || "").trim();
  const requestNote = String(input.requestNote || "").trim();

  if (!professionalUserId) {
    throw new Error("professionalUserId é obrigatório.");
  }

  const { data: requestId, error: createError } = await supabase.rpc("create_contact_access_request", {
    p_professional_user_id: professionalUserId,
    p_request_note: requestNote || null,
  });

  if (createError || !requestId) {
    const isDuplicatePending =
      createError?.code === "23505" ||
      String(createError?.message || "").toLowerCase().includes("idx_contact_access_requests_pending_unique");

    if (isDuplicatePending) {
      const { data: existingRows, error: existingError } = await supabase
        .from("contact_access_requests")
        .select("id")
        .eq("professional_user_id", professionalUserId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false })
        .limit(1);

      if (!existingError && existingRows && existingRows.length > 0) {
        return { requestId: String(existingRows[0].id) };
      }
    }

    throw new Error(createError?.message || "Você já possui uma solicitação pendente para este profissional.");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  await supabase.functions.invoke("send_contact_release_push", {
    body: {
      professionalUserId,
      requestId,
      requesterName: user?.user_metadata?.name || user?.user_metadata?.nome || null,
      requesterEmail: user?.email || null,
      requestNote: requestNote || null,
    },
    headers: session?.access_token
      ? {
          Authorization: `Bearer ${session.access_token}`,
        }
      : undefined,
  });

  return { requestId: String(requestId) };
}
