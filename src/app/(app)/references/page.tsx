import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getActiveWorkspace } from "@/lib/workspaces";
import { prisma } from "@/lib/prisma";

type SearchParams = { [key: string]: string | string[] | undefined };

type PageProps = {
  searchParams: Promise<SearchParams>;
};

/**
 * Reference Library Page
 * Based on AGENTS.md requirement: "Referenceライブラリ（Zotero-lite）"
 */
export default async function ReferencesPage({ searchParams }: PageProps) {
  const user = await requireUser();
  const workspace = await getActiveWorkspace(user.id);

  if (!workspace) {
    return <div className="panel">Select a workspace first.</div>;
  }

  const params = await searchParams;
  const query = String(params.q ?? "").trim();
  const typeFilter = String(params.type ?? "all");
  const sortBy = String(params.sort ?? "recent");

  // Build where clause
  const where: any = {
    workspaceId: workspace.id,
    softDeletedAt: null,
  };

  if (query) {
    where.OR = [
      { title: { contains: query, mode: "insensitive" } },
      { author: { contains: query, mode: "insensitive" } },
      { publisher: { contains: query, mode: "insensitive" } },
      { doi: { contains: query, mode: "insensitive" } },
      { url: { contains: query, mode: "insensitive" } },
    ];
  }

  if (typeFilter !== "all") {
    where.type = typeFilter;
  }

  // Build order clause
  let orderBy: any = { createdAt: "desc" };
  if (sortBy === "title") {
    orderBy = { title: "asc" };
  } else if (sortBy === "author") {
    orderBy = { author: "asc" };
  } else if (sortBy === "year") {
    orderBy = { publishedYear: "desc" };
  }

  const references = await prisma.reference.findMany({
    where,
    orderBy,
    take: 100,
    include: {
      citations: {
        take: 5,
        include: {
          entity: {
            select: { id: true, title: true, type: true }
          }
        }
      },
      _count: {
        select: { citations: true }
      }
    }
  });

  // Get reference type counts for filter
  const typeCounts = await prisma.reference.groupBy({
    by: ["type"],
    where: {
      workspaceId: workspace.id,
      softDeletedAt: null,
    },
    _count: true,
  });

  const typeOptions = [
    { value: "all", label: "All Types", count: references.length },
    ...typeCounts.map((tc) => ({
      value: tc.type,
      label: tc.type.charAt(0).toUpperCase() + tc.type.slice(1),
      count: tc._count,
    })),
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reference Library</h1>
          <p className="page-subtitle">
            Manage citations, sources, and bibliography for your worldbuilding
          </p>
        </div>
        <div className="page-actions">
          <Link href="/references/import" className="btn-secondary">
            Import (DOI/BibTeX)
          </Link>
          <Link href="/references/new" className="btn-primary">
            Add Reference
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="filters-bar">
        <form className="search-form" action="/references" method="get">
          <div className="search-input-wrapper">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              name="q"
              type="text"
              defaultValue={query}
              placeholder="Search by title, author, DOI..."
              className="search-input"
            />
          </div>
          <select name="type" defaultValue={typeFilter} className="filter-select">
            {typeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.count})
              </option>
            ))}
          </select>
          <select name="sort" defaultValue={sortBy} className="filter-select">
            <option value="recent">Recently Added</option>
            <option value="title">Title A-Z</option>
            <option value="author">Author A-Z</option>
            <option value="year">Year (Newest)</option>
          </select>
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      {/* Results */}
      {references.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-16 h-16">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3>No references found</h3>
          <p className="muted">
            {query
              ? `No references match "${query}"`
              : "Start building your reference library"}
          </p>
          <div className="empty-actions">
            <Link href="/references/new" className="btn-primary">
              Add Your First Reference
            </Link>
          </div>
        </div>
      ) : (
        <div className="reference-list">
          {references.map((ref) => (
            <div key={ref.id} className="reference-card">
              <div className="reference-header">
                <span className={`reference-type type-${ref.type}`}>
                  {ref.type}
                </span>
                <span className="reference-citations">
                  {ref._count.citations} citation{ref._count.citations !== 1 ? "s" : ""}
                </span>
              </div>

              <h3 className="reference-title">
                <Link href={`/references/${ref.id}`}>
                  {ref.title || "(Untitled)"}
                </Link>
              </h3>

              {ref.author && (
                <p className="reference-author">{ref.author}</p>
              )}

              <div className="reference-meta">
                {ref.publisher && <span>{ref.publisher}</span>}
                {ref.publishedYear && <span>{ref.publishedYear}</span>}
                {ref.doi && (
                  <a
                    href={`https://doi.org/${ref.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="reference-doi"
                  >
                    DOI: {ref.doi}
                  </a>
                )}
                {ref.url && !ref.doi && (
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="reference-url"
                  >
                    View Source
                  </a>
                )}
              </div>

              {/* License info */}
              {ref.license && (
                <div className="reference-license">
                  <span className="license-badge">{ref.license}</span>
                </div>
              )}

              {/* Linked entities */}
              {ref.citations.length > 0 && (
                <div className="reference-linked">
                  <span className="linked-label">Used in:</span>
                  <div className="linked-entities">
                    {ref.citations.map((citation) =>
                      citation.entity ? (
                        <Link
                          key={citation.id}
                          href={`/wiki/${encodeURIComponent(citation.entity.title.replace(/ /g, "_"))}`}
                          className="linked-entity-chip"
                        >
                          {citation.entity.title}
                        </Link>
                      ) : null
                    )}
                    {ref._count.citations > 5 && (
                      <span className="linked-more">
                        +{ref._count.citations - 5} more
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="reference-actions">
                <Link href={`/references/${ref.id}`} className="btn-link">
                  View Details
                </Link>
                <Link href={`/references/${ref.id}/edit`} className="btn-link">
                  Edit
                </Link>
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => navigator.clipboard.writeText(ref.citationText || ref.title || "")}
                >
                  Copy Citation
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      <aside className="reference-stats">
        <h4>Library Stats</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-value">{references.length}</span>
            <span className="stat-label">Total References</span>
          </div>
          {typeCounts.map((tc) => (
            <div key={tc.type} className="stat-item">
              <span className="stat-value">{tc._count}</span>
              <span className="stat-label">{tc.type}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
