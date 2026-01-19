import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/auth";

type JoinPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function JoinPage({ params }: JoinPageProps) {
  const { slug } = await params;
  const workspaceSlug = String(slug ?? "").trim().toLowerCase();

  if (!workspaceSlug) {
    notFound();
  }

  const workspace = await prisma.workspace.findUnique({
    where: { slug: workspaceSlug },
    select: { id: true, name: true, slug: true }
  });

  if (!workspace) {
    notFound();
  }

  const session = await getCurrentSession();
  const membership = session
    ? await prisma.workspaceMember.findFirst({
        where: { userId: session.userId, workspaceId: workspace.id },
        select: { role: true }
      })
    : null;

  const maps = membership
    ? await prisma.map.findMany({
        where: { workspaceId: workspace.id, softDeletedAt: null },
        select: { id: true, title: true, imageAssetId: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 6
      })
    : [];

  const loginNext = `/join/${workspace.slug}`;

  return (
    <main className="min-h-screen bg-bg text-ink relative overflow-hidden">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-30%] left-[-10%] w-[620px] h-[620px] bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[520px] h-[520px] bg-blue-500/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        <header className="flex items-center justify-between mb-10">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.4em] text-muted">Depictionator</p>
            <h1 className="text-3xl font-black tracking-tight">{workspace.name}</h1>
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-muted">Workspace Invite</span>
        </header>

        <div
          className={
            membership
              ? "grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8"
              : "flex justify-center"
          }
        >
          {membership && (
            <section className="bg-panel border border-border rounded-2xl p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-widest text-muted">Map Preview</h2>
                <span className="text-xs text-muted">{maps.length} maps</span>
              </div>
              {maps.length === 0 && (
                <div className="border border-dashed border-border rounded-xl p-10 text-center text-sm text-muted">
                  No maps have been added yet.
                </div>
              )}
              {maps.length > 0 && (
                <div className="grid md:grid-cols-2 gap-4">
                  {maps.map((map) => {
                    const imageUrl = map.imageAssetId
                      ? `/api/assets/file/${map.imageAssetId}`
                      : null;
                    return (
                      <div key={map.id} className="bg-bg border border-border rounded-xl overflow-hidden">
                        <div className="aspect-[4/3] bg-slate-900/40 flex items-center justify-center relative">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={map.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="text-xs text-muted">No image</span>
                          )}
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-semibold">{map.title}</p>
                          <p className="text-[11px] text-muted">Updated {map.updatedAt.toLocaleDateString()}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          <aside
            className={`bg-panel border border-border rounded-2xl p-6 shadow-lg space-y-6 ${
              membership ? "" : "w-full max-w-md"
            }`}
          >
            <div className="space-y-2">
              <h2 className="text-lg font-bold">Join this workspace</h2>
              <p className="text-sm text-muted">
                You have been invited to collaborate on this worldbuilding project.
              </p>
            </div>

            {membership && (
              <div className="space-y-4">
                <div className="p-4 bg-bg border border-border rounded-xl text-sm">
                  You are already a member ({membership.role}).
                </div>
                <form action="/api/workspaces/open" method="post">
                  <input type="hidden" name="slug" value={workspace.slug} />
                  <button className="w-full py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/20 hover:bg-accent-hover hover:shadow-accent/40 active:scale-[0.98] transition-all">
                    Open Workspace
                  </button>
                </form>
              </div>
            )}

            {!membership && session && (
              <form action="/api/workspaces/join" method="post" className="space-y-3">
                <input type="hidden" name="slug" value={workspace.slug} />
                <button className="w-full py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/20 hover:bg-accent-hover hover:shadow-accent/40 active:scale-[0.98] transition-all">
                  Join Workspace
                </button>
                <p className="text-[11px] text-muted text-center">Role defaults to viewer.</p>
              </form>
            )}

            {!session && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Sign in or create an account to join this workspace.
                </p>
                <div className="grid gap-3">
                  <Link
                    href={`/login?next=${encodeURIComponent(loginNext)}`}
                    className="w-full text-center py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/20 hover:bg-accent-hover hover:shadow-accent/40 transition-all"
                  >
                    Sign In
                  </Link>
                  <Link
                    href={`/register?next=${encodeURIComponent(loginNext)}`}
                    className="w-full text-center py-3 border border-border rounded-xl font-bold text-sm hover:bg-bg transition-all"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
