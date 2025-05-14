import Link from "next/link";
import { SignIn } from "@/features/auth/ui/components/SignIn";

export default function AuthPage() {
  return (
    <div className="p-6">
      <h1 className="text-center text-4xl font-medium md:text-5xl">Auth</h1>
      <SignIn />
      <Link href="/">Go to /</Link>
    </div>
  );
}
