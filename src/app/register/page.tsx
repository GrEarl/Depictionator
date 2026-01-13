export default function RegisterPage() {
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Create Account</h1>
        <p>世界観データを構築するチーム用アカウント</p>
        <form action="/api/auth/register" method="post" className="auth-form">
          <label>
            Name
            <input type="text" name="name" />
          </label>
          <label>
            Email
            <input type="email" name="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" minLength={8} required />
          </label>
          <button type="submit">Create</button>
        </form>
        <div className="auth-links">
          <span>すでにアカウントがありますか？</span>
          <a href="/login">ログイン</a>
        </div>
      </div>
    </main>
  );
}
