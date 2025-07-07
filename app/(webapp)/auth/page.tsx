import Link from "next/link";
import { SignIn } from "@/features/auth/ui/components/SignIn";

export default function AuthPage() {
  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-8 text-center text-4xl font-medium md:text-5xl">
        Authentication
      </h1>
      <SignIn />
      <div className="mt-6 text-center">
        <Link href="/" className="text-blue-600 hover:underline">
          Go to Home
        </Link>
      </div>
    </div>
  );
}
