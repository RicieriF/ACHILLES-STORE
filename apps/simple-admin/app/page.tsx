"use client";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, session } from "../lib/api";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (session.get()) router.replace("/inicio");
  }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await api<{ token: string }>("auth/user/emailpass", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      session.set(result.token);
      router.push("/inicio");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">ACHILLES STORE</p>
        <h1>Organize sua vitrine</h1>
        <p className="muted">
          Entre com o mesmo acesso administrativo da loja.
        </p>
        {error && <div className="state error">{error}</div>}
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <button disabled={busy}>{busy ? "Entrando…" : "ENTRAR"}</button>
      </form>
    </div>
  );
}
