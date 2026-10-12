import { cacheLife } from "next/cache";
import { FooterClient } from "./FooterClient";

// The year only changes once a year; a daily refresh keeps it correct within
// a day of New Year at the cost of one tiny write per day.
async function getCurrentYear() {
  "use cache";
  cacheLife("days");

  return new Date().getFullYear();
}

export async function Footer({ className }: { className?: string }) {
  const currentYear = await getCurrentYear();

  return <FooterClient className={className} currentYear={currentYear} />;
}
