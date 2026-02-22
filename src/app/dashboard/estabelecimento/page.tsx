import { Container } from "@/components/atoms/Container";
import Link from "next/link";

export default function DashboardEstabelecimentoPage() {
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
