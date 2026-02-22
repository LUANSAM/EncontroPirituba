import { PropsWithChildren } from "react";
import clsx from "clsx";

interface CardProps extends PropsWithChildren {
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return <article className={clsx("rounded-lg bg-white p-2 shadow sm:p-3 md:p-4", className)}>{children}</article>;
}
