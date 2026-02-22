import { Container } from "@/components/atoms/Container";
import { ProfileHeader } from "@/components/molecules/ProfileHeader";

export default function ProfessionalPage() {
  return (
    <main className="py-8">
      <Container>
        <ProfileHeader type="professional" />
      </Container>
    </main>
  );
}
