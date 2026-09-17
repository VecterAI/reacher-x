import type { ReactNode } from "react";

export function MarketingMarquee({
  children,
  count,
}: {
  children: ReactNode;
  count: number;
}) {
  return (
    <div className="marketing-proof-window" data-single={count === 1}>
      {children}
    </div>
  );
}
