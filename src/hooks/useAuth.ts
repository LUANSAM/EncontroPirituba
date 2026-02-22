"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function useAuth() {
  const queryClient = useQueryClient();

  // Configurar listener para mudanças de autenticação
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Invalidar query quando houver mudança de autenticação
      queryClient.setQueryData(["auth", "session"], session);
      
      if (event === "SIGNED_IN") {
        queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      } else if (event === "SIGNED_OUT") {
        queryClient.clear();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) throw error;
      
      return data.session;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchOnWindowFocus: true,
  });
}
