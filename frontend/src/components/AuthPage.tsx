import { useEffect, useState, type FormEvent } from "react";
import { api, session } from "../api";
import type { Meta, Role, User } from "../types";
import Icon from "./Icon";

interface Props {
  initialMode: "login" | "register";
  onAuthed: (user: User) => void;
  onBack: () => void;
}

const COPY = {
  patient: {
    title: "Patient Portal",
    image: "/images/patient.svg",
    alt: "Patient checking a queue token on a phone",
    icon: "user",
    blurb: "Book OPD tokens, follow your wait time and check medicine and bed availability.",
    points: ["Book and track your OPD token", "See live wait estimates", "Check pharmacy stock before you travel"],
    headline: ["Your care,", "one tap away."],
    demo: { email: "patient@pulse.demo", password: "demo123" },
  },
  doctor: {
    title: "Doctor Portal",
    image: "/images/doctor.svg",
    alt: "Doctor with a stethoscope in a hospital corridor",
    icon: "stethoscope",
    blurb: "Run your OPD queue, admit patients to beds and keep pharmacy stock accurate.",
    points: ["Call the next patient in one click", "Allocate and discharge beds", "Dispense and restock medicines"],
    headline: ["Your clinic,", "under control."],
    demo: { email: "doctor@pulse.demo", password: "demo123" },
  },
} as const;

export default function AuthPage({ initialMode, onAuthed, onBack }: Props) {
  const [role, setRole] = useState<Role | null>(null);
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [meta, setMeta] = useState<Meta | null>(null);

  useEffect(() => setMode(initialMode), [initialMode]);

  // Departments are needed for doctor sign-up. The endpoint needs a login, so fall back to a static list.
  const departments = meta?.departments.map((d) => d.name) ?? [
    "General Medicine", "Cardiology", "Orthopedics", "Pediatrics", "Gynecology", "Neurology",
  ];
  useEffect(() => {
    if (!session.token()) return;
    api.meta().then(setMeta).catch(() => undefined);
  }, []);

  function chooseRole(next: Role) {
    setRole(next);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function fillDemo() {
    if (!role) return;
    setEmail(COPY[role].demo.email);
    setPassword(COPY[role].demo.password);
    setError("");
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!role) return;
    setError("");
    setBusy(true);
    try {
      const res =
        mode === "login"
          ? await api.login({ email, password, role })
          : await api.register({ name, email, password, role, phone, department, licenseId });
      session.save(res.token, res.user);
      onAuthed(res.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Step 1: choose a portal ---------- */
  if (!role) {
    return (
      <main className="portal-select">
        <button className="back-home" onClick={onBack}>
          ← Back to home
        </button>
        <div className="portal-intro">
          <h1>Choose your portal</h1>
          <p>Pick how you use PULSE. You can switch portals any time by logging out.</p>
        </div>
        <div className="portal-cards">
          {(["patient", "doctor"] as Role[]).map((r) => {
            const c = COPY[r];
            return (
              <button key={r} className={`portal-card portal-${r}`} onClick={() => chooseRole(r)}>
                <span className="portal-card-image">
                  <img src={c.image} alt={c.alt} />
                </span>
                <span className="portal-card-body">
                  <span className="portal-card-icon">
                    <Icon name={c.icon} size={22} />
                  </span>
                  <h2>{c.title}</h2>
                  <p>{c.blurb}</p>
                  <ul>
                    {c.points.map((p) => (
                      <li key={p}>
                        <Icon name="check" size={15} /> {p}
                      </li>
                    ))}
                  </ul>
                  <span className="portal-card-cta">
                    Continue to {c.title} <Icon name="arrow" size={16} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </main>
    );
  }

  /* ---------- Step 2: role-specific form ---------- */
  const c = COPY[role];
  return (
    <main className="auth-page">
      <section className="auth-visual">
        <div className="portal-visual-frame">
          <img src={c.image} alt={c.alt} />
        </div>
        <h1>
          {c.headline[0]}
          <br />
          {c.headline[1]}
        </h1>
        <p>{c.blurb}</p>
        <span className="auth-visual-footer">{c.title.toUpperCase()}</span>
      </section>

      <section className="auth-form-side">
        <button className="back-home" onClick={() => setRole(null)}>
          ← Change portal
        </button>
        <div className="auth-form-wrap">
          <span className={`role-badge role-badge-${role}`}>
            <Icon name={c.icon} size={15} /> {c.title}
          </span>
          <h2>{mode === "login" ? "Good to see you." : role === "doctor" ? "Create your physician account." : "Create your account."}</h2>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Enter your details to continue."
              : role === "doctor"
                ? "Your licence ID lets us verify you before you manage patients."
                : "Start your connected healthcare journey."}
          </p>

          <div className="mode-tabs" role="tablist">
            <button role="tab" aria-selected={mode === "login"} className={mode === "login" ? "on" : ""} onClick={() => { setMode("login"); setError(""); }}>
              Log in
            </button>
            <button role="tab" aria-selected={mode === "register"} className={mode === "register" ? "on" : ""} onClick={() => { setMode("register"); setError(""); }}>
              Create account
            </button>
          </div>

          <form className="auth-form" onSubmit={submit} noValidate>
            {mode === "register" && (
              <label>
                Full name
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={role === "doctor" ? "Dr. Full Name" : "Enter your full name"} autoComplete="name" required />
              </label>
            )}
            {mode === "register" && role === "doctor" && (
              <>
                <label>
                  Department
                  <select value={department} onChange={(e) => setDepartment(e.target.value)} required>
                    <option value="">Select department</option>
                    {departments.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Medical licence ID
                  <input value={licenseId} onChange={(e) => setLicenseId(e.target.value)} placeholder="e.g. MCI-204518" required />
                </label>
              </>
            )}
            {mode === "register" && role === "patient" && (
              <label>
                Phone number
                <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" inputMode="tel" autoComplete="tel" />
              </label>
            )}
            <label>
              Email address
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
            </label>
            <label>
              Password
              <span className="pw-field">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                />
                <button type="button" className="pw-toggle" onClick={() => setShowPassword((s) => !s)}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </span>
            </label>

            {error && (
              <p className="form-notice form-error" role="alert">
                {error}
              </p>
            )}

            <button className="button button-dark auth-submit" type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? `Log in to ${c.title}` : "Create account"}
              <span>↗</span>
            </button>
          </form>

          {mode === "login" && (
            <button className="demo-fill" onClick={fillDemo} type="button">
              Fill the demo {role} login
            </button>
          )}
          <p className="demo-disclaimer">Demo hospital data. Do not enter real medical information.</p>
        </div>
      </section>
    </main>
  );
}
