import { useEffect, useState } from "react";
import { session } from "./api";
import type { User } from "./types";
import Landing from "./components/Landing";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/dashboard/Dashboard";

type Page = "home" | "auth";

function App() {
  const [page, setPage] = useState<Page>("home");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [activeNav, setActiveNav] = useState("Home");
  const [user, setUser] = useState<User | null>(() => (session.token() ? session.user() : null));

  // Any 401 from the API clears the session and returns here.
  useEffect(() => {
    const onLogout = () => {
      setUser(null);
      setPage("home");
    };
    window.addEventListener("pulse:logout", onLogout);
    return () => window.removeEventListener("pulse:logout", onLogout);
  }, []);

  function navigate(section: string) {
    setPage("home");
    setActiveNav(section);
    window.setTimeout(() => {
      if (section === "Home") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        document.getElementById(section.toLowerCase())?.scrollIntoView({ behavior: "smooth" });
      }
    }, 80);
  }

  function openAuth(mode: "login" | "register") {
    setAuthMode(mode);
    setPage("auth");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function logout() {
    session.clear();
    setUser(null);
    setPage("home");
    window.scrollTo({ top: 0 });
  }

  if (user) return <Dashboard user={user} onLogout={logout} />;

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={() => navigate("Home")} aria-label="PULSE home">
          <span className="brand-mark">P</span>
          <span>
            PULSE<span className="brand-dot">.</span>
          </span>
        </button>

        <nav className="main-nav" aria-label="Main navigation">
          {["Home", "About", "Services"].map((item) => (
            <button
              key={item}
              className={activeNav === item && page === "home" ? "nav-link active" : "nav-link"}
              onClick={() => navigate(item)}
            >
              {item}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          <button className="login-link" onClick={() => openAuth("login")}>
            Log in
          </button>
          <button className="button button-dark header-cta" onClick={() => openAuth("register")}>
            Get started <span>↗</span>
          </button>
        </div>
      </header>

      {page === "home" && <Landing openAuth={openAuth} navigate={navigate} />}
      {page === "auth" && (
        <AuthPage initialMode={authMode} onAuthed={setUser} onBack={() => navigate("Home")} />
      )}

      <footer className="site-footer">
        <button className="footer-brand" onClick={() => navigate("Home")}>
          PULSE<span>.</span>
        </button>
        <span>© {new Date().getFullYear()} PULSE. Patient Unified Logistics and Service Ecosystem.</span>
      </footer>
    </div>
  );
}

export default App;
