import { Container } from "@/components/atoms/Container";
import { AdminReviewTable } from "@/components/organisms/AdminReviewTable";

export default function AdminReviewPage() {
  return (
    <main className="py-8">
      <Container>
        <h1 className="mb-4 text-2xl font-bold text-blue-900">Admin - Aprovações</h1>
        <AdminReviewTable />
      </Container>
    </main>
  );
}
