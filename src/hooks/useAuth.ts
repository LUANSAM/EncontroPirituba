"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function useAuth() {
  const queryClient = useQueryClient();

  // Configurar listener para mudanças de autenticação
  useEffect(() => {
    console.log("[useAuth] Configurando listener de autenticação");

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[useAuth] Auth state changed:", event, "User ID:", session?.user?.id || "none");
      
      // Invalidar query quando houver mudança de autenticação
      queryClient.setQueryData(["auth", "session"], session);
      
      if (event === "SIGNED_IN") {
        console.log("[useAuth] Usuário logado, invalidando queries");
        queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      } else if (event === "SIGNED_OUT") {
        console.log("[useAuth] Usuário deslogado, limpando cache");
        queryClient.clear();
      }
    });

    return () => {
      console.log("[useAuth] Removendo listener de autenticação");
      subscription.unsubscribe();
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["auth", "session"],
    queryFn: async () => {
      console.log("[useAuth] Buscando sessão atual");
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("[useAuth] Erro ao buscar sessão:", error);
        throw error;
      }
      
      console.log("[useAuth] Sessão obtida:", {
        hasSession: !!data.session,
        userId: data.session?.user?.id || "none",
        email: data.session?.user?.email || "none"
      });
      
      return data.session;
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchOnWindowFocus: true,
  });
}
