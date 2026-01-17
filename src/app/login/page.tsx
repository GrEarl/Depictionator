import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-bg relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md p-8 relative z-10">
        <div className="bg-panel border border-border shadow-2xl rounded-2xl p-8 space-y-8 animate-fade-in">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight text-ink">Depictionator</h1>
            <p className="text-sm text-muted">Sign in to your workspace</p>
          </div>

          <form action="/api/auth/login" method="post" className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">Email</label>
              <input 
                type="email" 
                name="email" 
                required 
                className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent transition-all"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted">Password</label>
              <input 
                type="password" 
                name="password" 
                required 
                className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm outline-none focus:ring-2 focus:ring-accent transition-all"
                placeholder="••••••••"
              />
            </div>
            
            <button 
              type="submit" 
              className="w-full py-3 bg-accent text-white font-bold rounded-xl shadow-lg shadow-accent/20 hover:bg-accent-hover hover:shadow-accent/40 active:scale-[0.98] transition-all"
            >
              Sign In
            </button>
          </form>

          <div className="text-center text-sm text-muted">
            <span>New here? </span>
            <Link href="/register" className="text-accent font-bold hover:underline">
              Create an account
            </Link>
          </div>
        </div>
        
        <p className="text-center text-[10px] text-mutedmt-8 opacity-50 mt-8">
          &copy; 2026 Depictionator. Worldbuilding for professionals.
        </p>
      </div>
    </main>
  );
}


