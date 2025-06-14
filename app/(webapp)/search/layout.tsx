// app/(webapp)/search/layout.tsx
import { FilterProvider } from "@/features/search/contexts/FilterContext";
import { SortProvider } from "@/features/search/contexts/SortContext";
import { SearchLayout } from "./components/SearchLayout";

export default function SearchLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <FilterProvider>
      <SortProvider>
        <SearchLayout>{children}</SearchLayout>
      </SortProvider>
    </FilterProvider>
  );
}
