import { Card } from "@/components/atoms/Card";
import clsx from "clsx";

interface ListingCardProps {
  title: string;
  subtitle: string;
  horizontal?: boolean;
}

export function ListingCard({ title, subtitle, horizontal = false }: ListingCardProps) {
  return (
    <Card className={clsx("gap-2 sm:gap-3 md:gap-4", horizontal ? "flex flex-col md:flex-row" : "flex flex-col")}>
      <div className="h-16 rounded-lg bg-blue-100 sm:h-20 md:h-24 md:w-32" />
      <div className="flex-1">
        <h3 className="text-sm font-bold text-blue-900 sm:text-base">{title}</h3>
        <p className="text-xs sm:text-sm">{subtitle}</p>
      </div>
      <button className="rounded-lg bg-blue-900 px-3 py-1.5 text-xs text-white sm:px-4 sm:py-2 sm:text-sm">Ver detalhes</button>
    </Card>
  );
}
