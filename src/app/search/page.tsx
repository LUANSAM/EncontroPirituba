import { Container } from "@/components/atoms/Container";
import { ListingCard } from "@/components/molecules/ListingCard";
import { MapView } from "@/components/organisms/MapView";

export default function SearchPage() {
  return (
    <main className="py-8">
      <Container>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <section className="space-y-3 lg:col-span-2">
            <div className="rounded-lg bg-white p-4 shadow">Filtros: categoria, distância, avaliação, preço, voucher</div>
            {Array.from({ length: 5 }).map((_, idx) => (
              <ListingCard key={idx} title={`Resultado ${idx + 1}`} subtitle="Detalhes do serviço" horizontal />
            ))}
          </section>
          <section className="lg:col-span-1">
            <MapView />
          </section>
        </div>
      </Container>
    </main>
  );
}
