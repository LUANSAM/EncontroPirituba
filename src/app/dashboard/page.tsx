"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Container } from "@/components/atoms/Container";
import { supabase } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted || !user?.email) {
        router.replace("/auth");
        return;
      }

      const { data } = await supabase
        .from("usuarios")
        .select("role")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1);

      const role = data?.[0]?.role;

      if (role === "profissional") {
        router.replace("/dashboard/profissional");
        return;
      }

      if (role === "estabelecimento") {
        router.replace("/dashboard/estabelecimento");
        return;
      }

      router.replace("/dashboard/cliente");
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="py-8">
      <Container>
        <p className="text-sm text-graytext">Redirecionando para seu dashboard...</p>
      </Container>
    </main>
  );
}
