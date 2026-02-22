"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

interface AuthFormData {
  email: string;
  password: string;
}

export function AuthForm() {
  const { register, handleSubmit } = useForm<AuthFormData>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();

  const onSubmit = async (data: AuthFormData) => {
    setLoading(true);
    setError("");

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.session) {
        setError("Login realizado mas sessão não foi criada.");
        setLoading(false);
        return;
      }

      // Invalidar cache do React Query para forçar recarregar sessão
      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });

      // Aguardar um pouco para garantir que a sessão foi persistida
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verificar se perfil existe
      const { data: usuarioData, error: usuarioError } = await supabase
        .from("usuarios")
        .select("role")
        .eq("email", data.email)
        .order("created_at", { ascending: false })
        .limit(1);

      if (usuarioError || !usuarioData || usuarioData.length === 0) {
        router.push("/onboarding/recepcao");
      } else {
        const role = usuarioData[0].role;
        
        const dashboardPath = 
          role === "profissional" ? "/dashboard/profissional" :
          role === "estabelecimento" ? "/dashboard/estabelecimento" :
          "/dashboard/cliente";
        
        router.push(dashboardPath);
      }

      router.refresh();
    } catch {
      setError("Erro ao fazer login. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="space-y-3 rounded-lg bg-white p-4 shadow" onSubmit={handleSubmit(onSubmit)}>
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      
      <input 
        {...register("email")} 
        className="w-full rounded-lg border px-3 py-2" 
        placeholder="Email"
        type="email"
        required
        disabled={loading}
      />
      <input
        {...register("password")}
        className="w-full rounded-lg border px-3 py-2"
        placeholder="Senha"
        type="password"
        required
        disabled={loading}
      />
      <button 
        className="w-full rounded-lg bg-blue-900 px-4 py-2 text-white disabled:opacity-50" 
        type="submit"
        disabled={loading}
      >
        {loading ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
