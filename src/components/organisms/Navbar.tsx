"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/atoms/Container";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase/client";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { data: session, isLoading } = useAuth();

  const isAuthenticated = Boolean(session?.user?.id);
  const metadataName =
    session?.user?.user_metadata?.name || session?.user?.user_metadata?.full_name || session?.user?.user_metadata?.first_name;
  const emailName = session?.user?.email?.split("@")[0];
  const displayName = (metadataName || emailName || "Cliente").toString();
  const isRegistrationPage = pathname === "/auth" || pathname.startsWith("/onboarding");
  const shouldShowAuthButton = isAuthenticated || !isRegistrationPage;

  useEffect(() => {
    let mounted = true;

    if (!session?.user?.email) {
      setUserRole(null);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from("usuarios")
        .select("role")
        .eq("email", session.user.email)
        .order("created_at", { ascending: false })
        .limit(1);

      if (!mounted) return;
      setUserRole(data?.[0]?.role || null);
    })();

    return () => {
      mounted = false;
    };
  }, [session?.user?.email]);

  const dashboardHref =
    userRole === "profissional"
      ? "/dashboard/profissional"
      : userRole === "estabelecimento"
        ? "/dashboard/estabelecimento"
        : "/dashboard/cliente";

  const profileHref =
    userRole === "profissional"
      ? "/dashboard/profissional/perfil"
      : userRole === "estabelecimento"
        ? "/dashboard/estabelecimento/perfil"
        : "/dashboard/cliente";

  const handleAuthAction = async () => {
    if (isAuthenticated) {
      await supabase.auth.signOut();
      await queryClient.invalidateQueries({ queryKey: ["auth", "session"] });
      setOpen(false);
      router.refresh();
      return;
    }

    setOpen(false);
    router.push("/auth");
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-white shadow-sm">
      <Container>
        <div className="flex h-16 items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button aria-label="Abrir menu lateral" className="text-xl text-blue-900" onClick={() => setOpen(true)} type="button">
              ☰
            </button>
            <div className="flex flex-col leading-tight">
              <Link className="text-lg font-bold text-blue-900" href="/">
                Encontro Pirituba
              </Link>
              {isAuthenticated && <span className="text-xs text-graytext">Olá, {displayName}</span>}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {isAuthenticated && (
              <Link className="rounded-lg bg-blue-500 px-3 py-2 text-sm font-semibold text-white hover:bg-accent" href={profileHref}>
                Perfil
              </Link>
            )}
            {shouldShowAuthButton && (
              <button
                className={`inline-flex items-center gap-1 font-semibold ${isAuthenticated ? "text-sm text-red-600 hover:text-red-700" : "text-base text-green-700 hover:text-green-600"}`}
                disabled={isLoading}
                onClick={handleAuthAction}
                type="button"
              >
                {isAuthenticated ? (
                  <>
                    <span aria-hidden>
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        <path d="M16 17l5-5-5-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                        <path d="M21 12H9" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                      </svg>
                    </span>
                    <span>Sair</span>
                  </>
                ) : (
                  <>
                    <span>Entrar</span>
                    <span>→</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {open && <div className="fixed inset-0 z-40 bg-black/35" onClick={() => setOpen(false)} />}

        <aside
          className={`fixed left-0 top-0 z-50 h-full w-[200px] rounded-r-xl bg-white shadow-xl transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="relative h-[150px] border-b-2 border-blue-500 px-3 py-2">
            <div className="relative mx-auto h-full w-full">
              <Image
                fill
                alt="Logo Encontro Pirituba"
                className="object-contain"
                src="/images/logo/encontro-pirituba-logo.png"
              />
            </div>

          </div>

          <nav className="space-y-2 p-4 text-sm">
            <Link className="block rounded-lg border px-3 py-2 text-blue-900 hover:bg-blue-50" href={isAuthenticated ? dashboardHref : "/"} onClick={() => setOpen(false)}>
              Início
            </Link>

            {isAuthenticated && (
              <>
                <button className="block w-full rounded-lg border px-3 py-2 text-left text-blue-900 hover:bg-blue-50" type="button">
                  Histórico
                </button>
                <button className="block w-full rounded-lg border px-3 py-2 text-left text-blue-900 hover:bg-blue-50" type="button">
                  Avaliações
                </button>
                <button className="block w-full rounded-lg border px-3 py-2 text-left text-blue-900 hover:bg-blue-50" type="button">
                  Cupons
                </button>
                <button className="block w-full rounded-lg border px-3 py-2 text-left text-blue-900 hover:bg-blue-50" type="button">
                  Favoritos
                </button>
              </>
            )}
          </nav>
        </aside>
      </Container>
    </header>
  );
}
