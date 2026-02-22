"use client";

import { useRouter } from "next/navigation";
import { Container } from "@/components/atoms/Container";

export default function DadosIniciaisPage() {
  const router = useRouter();

  return (
    <main className="py-8">
      <Container>
        <section className="mx-auto max-w-xl rounded-lg border bg-white p-5 shadow">
          <h1 className="text-xl font-bold text-blue-900">Dados Iniciais</h1>
          <p className="mt-2 text-sm text-graytext">Cadastro concluído com sucesso. Complete seus dados iniciais para personalizar sua experiência.</p>
          <button className="mt-4 rounded-lg bg-blue-900 px-4 py-2 text-white" onClick={() => router.push("/")} type="button">
            Ir para Página Inicial
          </button>
        </section>
      </Container>
    </main>
  );
}
