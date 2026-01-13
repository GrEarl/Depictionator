import { FilterSummary } from "@/components/FilterSummary";

export default function MapsPage() {
  return (
    <div className="panel">
      <h2>Maps</h2>
      <FilterSummary />
      <p className="muted">Map hierarchy, pins, and paths will appear here.</p>
    </div>
  );
}
