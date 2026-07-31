import { getGitHubStarsCount } from "@/features/landing/lib/getGitHubStars";
import { Header } from "@/features/landing/ui/components/Header";
import { Footer } from "@/features/landing/ui/components/Footer";
import { LandingAutoPlayProvider } from "@/features/landing/ui/components/LandingAutoPlayProvider";
import { VariantSwitcher } from "@/features/landing/ui/components/variants/VariantSwitcher";

export default async function LandingShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const githubStarsCount = await getGitHubStarsCount();
  const showVariantSwitcher = process.env.NODE_ENV === "development";

  return (
    <div>
      <Header githubStarsCount={githubStarsCount} />
      <LandingAutoPlayProvider>
        <main>{children}</main>
      </LandingAutoPlayProvider>
      <Footer />
      {showVariantSwitcher ? <VariantSwitcher /> : null}
    </div>
  );
}
