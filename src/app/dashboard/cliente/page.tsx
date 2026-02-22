import { Container } from "@/components/atoms/Container";

export default function DashboardClientePage() {
  return (
    <main className="py-8">
      <Container>
        <section className="rounded-lg border bg-white p-5 shadow">
          <h1 className="text-2xl font-bold text-blue-900">Dashboard do Cliente</h1>
          <p className="mt-2 text-graytext">Acompanhe seus pedidos, vouchers e favoritos.</p>
        </section>
      </Container>
    </main>
  );
}
