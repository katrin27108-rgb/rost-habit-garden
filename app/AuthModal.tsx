"use client";

import { FormEvent, useState } from "react";

export default function AuthModal({ onClose }: { onClose(): void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, email, password, displayName }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Не удалось войти");
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось войти");
      setBusy(false);
    }
  }

  return <div className="modal-backdrop" role="presentation">
    <section className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Закрыть">×</button>
      <p className="eyebrow">Облачный сад</p>
      <h2 id="auth-title">{mode === "login" ? "С возвращением" : "Создать свой сад"}</h2>
      <p className="modal-intro">Войдите с телефона и компьютера под одной почтой — привычки и растения будут синхронизироваться.</p>
      <div className="auth-tabs">
        <button type="button" className={mode === "login" ? "is-active" : ""} onClick={() => { setMode("login"); setError(""); }}>Войти</button>
        <button type="button" className={mode === "register" ? "is-active" : ""} onClick={() => { setMode("register"); setError(""); }}>Регистрация</button>
      </div>
      <form className="auth-form" onSubmit={submit}>
        {mode === "register" && <label><span>Как вас называть</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} placeholder="Например, Катя" required /></label>}
        <label><span>Почта</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@example.com" required /></label>
        <label><span>Пароль</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="Не меньше 8 символов" required /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="modal-submit" disabled={busy} type="submit"><span>{busy ? "Подключаю сад…" : mode === "login" ? "Войти и синхронизировать" : "Создать аккаунт"}</span><b>→</b></button>
      </form>
      <p className="auth-note">Пароль хранится только в защищённом виде. Мы не отправляем рекламные письма.</p>
    </section>
  </div>;
}
