"use client";

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

interface ReserveVoucherPayload {
  voucher_id: string;
  service_id: string | null;
}

export function useBookings() {
  return useMutation({
    mutationFn: async ({ voucher_id, service_id }: ReserveVoucherPayload) => {
      const { data, error } = await supabase.rpc("reserve_voucher_atomic", {
        p_voucher_id: voucher_id,
        p_service_id: service_id,
      });
      if (error) throw error;
      return data;
    },
  });
}
