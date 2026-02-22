import { Container } from "@/components/atoms/Container";

export default function DashboardProfissionalPage() {
  return (
    <main className="py-8">
      <Container>
        <section className="rounded-lg border bg-white p-5 shadow">
          <h1 className="text-2xl font-bold text-blue-900">Dashboard do Profissional</h1>
          <p className="mt-2 text-graytext">Gerencie seus serviços, agenda e visibilidade local.</p>
        </section>
      </Container>
    </main>
  );
}
