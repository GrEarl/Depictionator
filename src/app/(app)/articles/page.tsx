import { FilterSummary } from "@/components/FilterSummary";

export default function ArticlesPage() {
  return (
    <div className="panel">
      <h2>Articles</h2>
      <FilterSummary />
      <p className="muted">Article CRUD, overlays, and revision history will appear here.</p>
    </div>
  );
}
