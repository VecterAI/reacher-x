import Link from "next/link";

export default function WebAppPage() {
  return (
    <div className="p-6">
      <h1 className="text-center text-4xl font-medium md:text-5xl">Home</h1>
      <Link href="/auth">Go to /auth</Link>
    </div>
  );
}
