"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Container } from "@/components/atoms/Container";
import { supabase } from "@/lib/supabase/client";

export default function DashboardEstabelecimentoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (!user?.email) {
        router.replace("/");
        return;
      }

      const { data, error } = await supabase
        .from("usuarios")
        .select("role")
        .eq("email", user.email)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!mounted) return;

      if (error || !data || data.length === 0 || data[0].role !== "estabelecimento") {
        router.replace("/");
        return;
      }

      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (loading) {
    return (
      <main className="py-8">
        <Container>
          <p className="rounded-lg border bg-white p-4 text-sm text-graytext">Validando acesso...</p>
        </Container>
      </main>
    );
  }

  return (
    <main className="py-8">
      <Container>
        <section className="rounded-lg border bg-white p-5 shadow">
          <h1 className="text-2xl font-bold text-blue-900">Dashboard do Estabelecimento</h1>
          <p className="mt-2 text-graytext">Acompanhe campanhas, vouchers e desempenho do estabelecimento.</p>
          <Link className="mt-4 inline-block rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800" href="/tokens">
            Comprar tokens via Pix
          </Link>
        </section>
      </Container>
    </main>
  );
}
