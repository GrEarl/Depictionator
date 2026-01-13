export default function LoginPage() {
  return (
    <main className="auth">
      <div className="auth-card">
        <h1>Depictionator</h1>
        <p>ログインしてワークスペースへ</p>
        <form action="/api/auth/login" method="post" className="auth-form">
          <label>
            Email
            <input type="email" name="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" required />
          </label>
          <button type="submit">Login</button>
        </form>
        <div className="auth-links">
          <span>初めてですか？</span>
          <a href="/register">新規登録</a>
        </div>
      </div>
    </main>
  );
}

