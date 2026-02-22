"use client";

import { useRouter } from "next/navigation";
import { Container } from "@/components/atoms/Container";

export default function ConfiguracoesIniciaisPage() {
  const router = useRouter();

  return (
    <main className="py-8">
      <Container>
        <section className="mx-auto max-w-xl rounded-lg border bg-white p-5 shadow">
          <h1 className="text-xl font-bold text-blue-900">Configurações Iniciais</h1>
          <p className="mt-2 text-sm text-graytext">
            Etapa pronta. Nos próximos passos você poderá incluir descrição, horários e conteúdos do perfil.
          </p>
          <button className="mt-4 rounded-lg bg-blue-900 px-4 py-2 text-white" onClick={() => router.push("/dashboard")} type="button">
            Ir para Dashboard
          </button>
        </section>
      </Container>
    </main>
  );
}
