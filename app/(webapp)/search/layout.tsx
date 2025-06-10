// app/(webapp)/search/layout.tsx
import { FilterProvider } from "@/features/search/contexts/FilterContext";
import { SearchLayout } from "./components/SearchLayout";

export default function SearchLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FilterProvider>
      <SearchLayout>{children}</SearchLayout>
    </FilterProvider>
  );
}
