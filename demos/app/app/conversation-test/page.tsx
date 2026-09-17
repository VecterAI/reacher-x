import { Suspense } from "react";
import { ConversationHarness } from "../../runtime/ConversationHarness";

export const metadata = {
  title: "Frontend parity experiment",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={<p>Loading conversation…</p>}>
      <ConversationHarness />
    </Suspense>
  );
}
