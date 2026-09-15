import { getGitHubStarsCount } from "@/features/landing/lib/getGitHubStars";
import { Header } from "@/features/landing/ui/components/Header";
import { Footer } from "@/features/landing/ui/components/Footer";

export default async function LandingShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const githubStarsCount = await getGitHubStarsCount();

  return (
    <div className="overflow-x-clip">
      <Header githubStarsCount={githubStarsCount} />
      <main>{children}</main>
      <Footer />
    </div>
  );
}
