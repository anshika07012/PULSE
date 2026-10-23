import { useCallback, useEffect, useState } from "react";
import { api } from "../../api";
import { useNow, usePolling } from "../../hooks/usePolling";
import type { Meta, Notify, User } from "../../types";
import Icon from "../Icon";
import Analytics from "./Analytics";
import BedMatrix from "./BedMatrix";
import PharmacyInventory from "./PharmacyInventory";
import QueueTracker from "./QueueTracker";

type View = "overview" | "queue" | "pharmacy" | "beds" | "analytics";

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "overview", label: "Command center", icon: "dashboard" },
  { id: "queue", label: "OPD queue", icon: "queue" },
  { id: "pharmacy", label: "Pharmacy", icon: "pill" },
  { id: "beds", label: "Beds and wards", icon: "bed" },
  { id: "analytics", label: "Analytics", icon: "chart" },
];

interface Toast {
  id: number;
  message: string;
  tone: "ok" | "error";
}

export default function Dashboard({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [view, setView] = useState<View>("overview");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [queueDepartment, setQueueDepartment] = useState(user.department ?? "");
  const now = useNow(1000);

  const queue = usePolling(
    () => queueDepartment
      ? api.queue(queueDepartment)
      : Promise.resolve({ tokens: [], stats: { waiting: 0, inConsultation: 0, completedToday: 0, avgWaitMin: 0 } }),
    4000
  );
  const pharmacy = usePolling(() => api.pharmacy(), 8000);
  const beds = usePolling(api.beds, 6000);
  const analytics = usePolling(api.analytics, 10000);

  useEffect(() => {
    api.meta().then((nextMeta) => {
      setMeta(nextMeta);
      if (!queueDepartment && nextMeta.departments[0]) setQueueDepartment(nextMeta.departments[0].name);
    }).catch(() => undefined);
  }, [queueDepartment]);

  useEffect(() => {
    if (queueDepartment) queue.reload();
  }, [queueDepartment, queue.reload]);

  const notify: Notify = useCallback((message: string, tone: "ok" | "error" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, message, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  // Refresh analytics whenever the queue changes, since congestion depends on it.
  const reloadQueue = useCallback(async () => {
    await queue.reload();
    analytics.reload();
  }, [queue.reload, analytics.reload]);

  const isDoctor = user.role === "doctor";
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const offline = queue.error || beds.error || pharmacy.error;

  const q = queue.data?.stats;
  const b = beds.data?.summary;
  const p = pharmacy.data?.summary;

  const kpis = [
    { icon: "queue", label: "Patients waiting", value: q ? String(q.waiting) : "–", note: q ? `${q.inConsultation} in consultation` : "", tone: "teal" },
    { icon: "clock", label: "Average wait", value: q ? `${q.avgWaitMin} min` : "–", note: q ? `${q.completedToday} seen today` : "", tone: "teal" },
    { icon: "bed", label: "Beds available", value: b ? String(b.available) : "–", note: b ? `${b.occupancy}% occupancy` : "", tone: b && b.occupancy >= 85 ? "red" : b && b.occupancy >= 60 ? "amber" : "green" },
    { icon: "pill", label: "Stock alerts", value: p ? String(p.low + p.out) : "–", note: p ? `${p.out} out of stock` : "", tone: p && p.low + p.out > 0 ? "amber" : "green" },
  ];

  const modules = {
    queue: <QueueTracker data={queue.data} meta={meta} user={user} notify={notify} reload={reloadQueue} onDepartmentChange={setQueueDepartment} compact={view === "overview"} />,
    pharmacy: <PharmacyInventory data={pharmacy.data} user={user} notify={notify} reload={pharmacy.reload} compact={view === "overview"} />,
    beds: <BedMatrix data={beds.data} user={user} notify={notify} reload={beds.reload} compact={view === "overview"} onOpen={() => setView("beds")} />,
    analytics: <Analytics data={analytics.data} />,
  };

  return (
    <div className="db-shell">
      <aside className="db-side">
        <button className="db-brand" onClick={() => setView("overview")} aria-label="PULSE command center">
          <span className="db-brand-mark">
            <Icon name="activity" size={18} />
          </span>
          <span>PULSE</span>
        </button>

        <nav aria-label="Dashboard sections">
          {NAV.map((n) => (
            <button key={n.id} className={view === n.id ? "on" : ""} onClick={() => setView(n.id)} aria-current={view === n.id ? "page" : undefined}>
              <Icon name={n.icon} size={18} /> <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <div className="db-user">
          <span className="db-avatar">{user.name.replace("Dr. ", "").charAt(0)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{isDoctor ? `Doctor · ${user.department}` : "Patient"}</small>
          </div>
          <button className="db-icon-btn" onClick={onLogout} aria-label="Log out" title="Log out">
            <Icon name="logout" size={17} />
          </button>
        </div>
      </aside>

      <div className="db-main">
        <header className="db-top">
          <div>
            <h1>
              {greeting}, {user.name.split(" ")[0] === "Dr." ? user.name.split(" ").slice(0, 2).join(" ") : user.name.split(" ")[0]}.
            </h1>
            <p>{isDoctor ? "Here is what is happening across the hospital right now." : "Track your visit, check medicines and see how busy we are."}</p>
          </div>
          <div className="db-top-right">
            <span className={`db-live ${offline ? "off" : ""}`}>
              <i /> {offline ? "Reconnecting" : "Live"}
            </span>
            <time>{new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
          </div>
        </header>

        {offline && (
          <div className="db-banner-error" role="alert">
            <Icon name="alert" size={18} /> {queue.error || beds.error || pharmacy.error}
          </div>
        )}

        {view === "overview" && (
          <>
            <section className="db-hero" aria-label="Facility">
              <img src="/images/hospital-banner.avif" alt="PULSE hospital" />
              <div>
                <h2>{isDoctor ? "Clinical command center" : "Your patient dashboard"}</h2>
                <p>{isDoctor ? "Call patients, assign beds and keep stock accurate." : "Book a token, follow your turn and plan your visit."}</p>
              </div>
            </section>

            <div className="db-kpis">
              {kpis.map((k) => (
                <article key={k.label} className={`db-kpi ${k.tone}`}>
                  <span className="db-kpi-icon">
                    <Icon name={k.icon} size={20} />
                  </span>
                  <div>
                    <b>{k.value}</b>
                    <span>{k.label}</span>
                    <small>{k.note}</small>
                  </div>
                </article>
              ))}
            </div>

            <div className="db-grid">
              <div className="span-7">{modules.queue}</div>
              <div className="span-5">{modules.beds}</div>
              <div className="span-7">{modules.pharmacy}</div>
              <div className="span-5">{modules.analytics}</div>
            </div>
          </>
        )}

        {view !== "overview" && <div className="db-single">{modules[view]}</div>}
      </div>

      <div className="db-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`db-toast ${t.tone}`}>
            <Icon name={t.tone === "ok" ? "check" : "alert"} size={16} /> {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}
