import { Container } from "@/components/atoms/Container";

export default function DashboardEstabelecimentoPage() {
  return (
    <main className="py-8">
      <Container>
        <section className="rounded-lg border bg-white p-5 shadow">
          <h1 className="text-2xl font-bold text-blue-900">Dashboard do Estabelecimento</h1>
          <p className="mt-2 text-graytext">Acompanhe campanhas, vouchers e desempenho do estabelecimento.</p>
        </section>
      </Container>
    </main>
  );
}
