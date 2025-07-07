import { withAuth } from "@workos-inc/authkit-nextjs";

export default async function DashboardPage() {
  // This will automatically redirect to login if user is not authenticated
  const { user } = await withAuth({ ensureSignedIn: true });

  return (
    <div className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Dashboard</h1>
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold">
          Welcome, {user.firstName || user.email}!
        </h2>
        <p className="text-gray-600">
          This is your protected dashboard. You can only see this page if
          you&apos;re authenticated.
        </p>
        <div className="mt-4">
          <a
            href="/logout"
            className="inline-block rounded bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Sign Out
          </a>
        </div>
      </div>
    </div>
  );
}
