"use client";

import { useRouter } from "next/navigation";
import { Container } from "@/components/atoms/Container";

export default function RecepcaoPage() {
  const router = useRouter();

  return (
    <main className="py-8">
      <Container>
        <section className="mx-auto max-w-xl rounded-lg border bg-white p-5 shadow">
          <h1 className="text-xl font-bold text-blue-900">Bem-vindo à jornada de ativação</h1>
          <p className="mt-2 text-sm text-graytext">
            CEP validado. Agora vamos para as configurações iniciais do seu perfil profissional/estabelecimento.
          </p>
          <button
            className="mt-4 rounded-lg bg-green-700 px-4 py-2 text-white"
            onClick={() => router.push("/onboarding/configuracoes-iniciais")}
            type="button"
          >
            Continuar
          </button>
        </section>
      </Container>
    </main>
  );
}
