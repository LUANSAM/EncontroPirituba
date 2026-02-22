import { PropsWithChildren } from "react";

export function GridResponsive({ children }: PropsWithChildren) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>;
}
