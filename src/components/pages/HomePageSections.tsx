import { CategoryChips } from "@/components/molecules/CategoryChips";
import { HeroCarousel } from "@/components/organisms/HeroCarousel";
import { LocationPermissionCard } from "@/components/organisms/LocationPermissionCard";

export function HomePageSections() {
  return (
    <div className="space-y-6">
      <HeroCarousel />
      <LocationPermissionCard />
      <CategoryChips />
    </div>
  );
}
