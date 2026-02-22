import { Container } from "@/components/atoms/Container";
import { ProfileHeader } from "@/components/molecules/ProfileHeader";

export default function EstablishmentPage() {
  return (
    <main className="py-8">
      <Container>
        <ProfileHeader type="establishment" />
      </Container>
    </main>
  );
}
