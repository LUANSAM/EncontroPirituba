import { Container } from "@/components/atoms/Container";

export default function DashboardPage() {
  return (
    <main className="py-8">
      <Container>
        <h1 className="text-2xl font-bold text-blue-900">Dashboard</h1>
        <p className="mt-2">Área autenticada para gestão de vouchers, serviços, horários e bookings.</p>
      </Container>
    </main>
  );
}
