import { Container } from "@/components/atoms/Container";
import { VoucherCard } from "@/components/molecules/VoucherCard";

export default function VoucherPage() {
  return (
    <main className="py-8">
      <Container>
        <VoucherCard />
      </Container>
    </main>
  );
}
