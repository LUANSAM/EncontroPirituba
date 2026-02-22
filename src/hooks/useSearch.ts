"use client";

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function useSearch() {
  return useQuery({
    queryKey: ["search", "vouchers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select("*")
        .eq("active", true)
        .gte("valid_to", new Date().toISOString())
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}
