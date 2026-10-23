import { useState, type FormEvent } from "react";
import { api } from "../../api";
import { useNow } from "../../hooks/usePolling";
import type { Meta, Notify, QueueResponse, Token, User } from "../../types";
import Icon from "../Icon";

interface Props {
  data: QueueResponse | null;
  meta: Meta | null;
  user: User;
  notify: Notify;
  reload: () => Promise<void>;
  compact?: boolean;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong.");

export default function QueueTracker({ data, meta, user, notify, reload, compact }: Props) {
  const now = useNow();
  const isDoctor = user.role === "doctor";
  const [booking, setBooking] = useState(false);
  const [busy, setBusy] = useState(false);

  // booking form state
  const [patientName, setPatientName] = useState("");
  const [dept, setDept] = useState(user.department ?? "");
  const [doc, setDoc] = useState("");
  const [reason, setReason] = useState("");
  const [urgent, setUrgent] = useState(false);

  const departments = meta?.departments ?? [];
  const chosenDept = dept || departments[0]?.name || "";
  const docsForDept = (meta?.doctors ?? []).filter((d) => d.department === chosenDept);
  const chosenDoc = docsForDept.some((d) => d.name === doc) ? doc : docsForDept[0]?.name ?? "";

  const tokens = data?.tokens ?? [];
  const serving = tokens.filter((t) => t.status === "in-consultation");
  const waiting = tokens
    .filter((t) => t.status === "waiting")
    .sort((a, b) => (a.priority === "urgent" ? 0 : 1) - (b.priority === "urgent" ? 0 : 1) || a.tokenNumber - b.tokenNumber);
  const mine = tokens.find((t) => t.mine && (t.status === "waiting" || t.status === "in-consultation"));
  const stats = data?.stats;

  async function book(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.bookToken({
        department: chosenDept,
        doctor: chosenDoc,
        reason,
        patientName: isDoctor ? patientName : undefined,
        priority: isDoctor && urgent ? "urgent" : "normal",
      });
      const t = res.token;
      notify(`Token #${t.tokenNumber} booked with ${t.doctor}.`);
      setBooking(false);
      setPatientName("");
      setReason("");
      setUrgent(false);
      await reload();
    } catch (err) {
      notify(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function callNext() {
    setBusy(true);
    try {
      const res = await api.callNext();
      notify(res.message ?? "Queue updated.", res.called ? "ok" : "error");
      await reload();
    } catch (err) {
      notify(errMsg(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(t: Token, status: "completed" | "cancelled") {
    try {
      await api.setTokenStatus(t._id, status);
      notify(status === "completed" ? `Token #${t.tokenNumber} completed.` : `Token #${t.tokenNumber} cancelled.`);
      await reload();
    } catch (err) {
      notify(errMsg(err), "error");
    }
  }

  const shownServing = compact ? serving.slice(0, 2) : serving;
  const shownWaiting = compact ? waiting.slice(0, 5) : waiting;

  return (
    <section className="db-card db-queue" id="module-queue" aria-labelledby="queue-title">
      <header className="db-card-head">
        <div>
          <h2 id="queue-title">
            <Icon name="queue" size={20} /> Live OPD queue
          </h2>
          <p>Updates every few seconds. Estimated waits use each department’s consultation time.</p>
        </div>
        <div className="db-actions">
          {isDoctor && (
            <button className="db-btn db-btn-primary" onClick={callNext} disabled={busy}>
              <Icon name="arrow" size={16} /> Call next patient
            </button>
          )}
          {(isDoctor || !mine) && (
            <button className="db-btn" onClick={() => setBooking((b) => !b)} aria-expanded={booking}>
              <Icon name={booking ? "x" : "plus"} size={16} /> {isDoctor ? "Add walk-in" : "Book a token"}
            </button>
          )}
        </div>
      </header>

      {booking && (
        <form className="db-form" onSubmit={book}>
          {isDoctor && (
            <label>
              Patient name
              <input value={patientName} onChange={(e) => setPatientName(e.target.value)} placeholder="Full name" required />
            </label>
          )}
          <label>
            Department
            <select value={chosenDept} onChange={(e) => setDept(e.target.value)}>
              {departments.map((d) => (
                <option key={d.name}>{d.name}</option>
              ))}
            </select>
          </label>
          <label>
            Doctor
            <select value={chosenDoc} onChange={(e) => setDoc(e.target.value)}>
              {docsForDept.map((d) => (
                <option key={d.name}>{d.name}</option>
              ))}
            </select>
          </label>
          <label className="db-form-wide">
            Reason for visit
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Fever for 3 days" maxLength={200} />
          </label>
          {isDoctor && (
            <label className="db-check">
              <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />
              Urgent (moves to the front of the line)
            </label>
          )}
          <button className="db-btn db-btn-primary" type="submit" disabled={busy || !chosenDoc}>
            Confirm booking
          </button>
        </form>
      )}

      {!isDoctor && mine && (
        <div className="db-mytoken">
          <div className="db-mytoken-num">#{mine.tokenNumber}</div>
          <div className="db-mytoken-info">
            <strong>{mine.status === "in-consultation" ? "It’s your turn." : "Your token"}</strong>
            <span>
              {mine.doctor} · {mine.department}
            </span>
            {mine.status === "waiting" && (
              <span>
                {mine.position === 1 ? "You are next." : `${mine.position} in line`} · about {mine.estimatedWaitMin} min
              </span>
            )}
          </div>
          {mine.status === "waiting" && (
            <button className="db-btn db-btn-ghost" onClick={() => setStatus(mine, "cancelled")}>
              Cancel token
            </button>
          )}
        </div>
      )}

      <div className="db-chips">
        <div><b>{stats?.waiting ?? "–"}</b><span>waiting</span></div>
        <div><b>{stats?.inConsultation ?? "–"}</b><span>in consultation</span></div>
        <div><b>{stats?.completedToday ?? "–"}</b><span>seen today</span></div>
        <div><b>{stats ? `${stats.avgWaitMin} min` : "–"}</b><span>average wait</span></div>
      </div>

      <h3 className="db-sub">Now serving</h3>
      {shownServing.length === 0 && <p className="db-empty">No consultation in progress. {isDoctor ? "Call the next patient to begin." : ""}</p>}
      <div className="db-serving">
        {shownServing.map((t) => {
          const elapsed = t.startedAt ? now - new Date(t.startedAt).getTime() : 0;
          const total = t.consultMinutes * 60000;
          const pct = Math.min(100, (elapsed / total) * 100);
          const over = elapsed > total;
          const mm = Math.floor(elapsed / 60000);
          const ss = String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0");
          return (
            <article key={t._id} className={`db-serve ${t.mine ? "is-mine" : ""}`}>
              <div className="db-serve-num">#{t.tokenNumber}</div>
              <div className="db-serve-body">
                <strong>{t.patientName}</strong>
                <span>
                  {t.doctor} · {t.department}
                </span>
                <div className="db-progress" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Consultation progress for token ${t.tokenNumber}`}>
                  <i className={over ? "amber" : ""} style={{ width: `${pct}%` }} />
                </div>
                <small>
                  {mm}:{ss} of {t.consultMinutes} min{over ? " · running over" : ""}
                </small>
              </div>
              {isDoctor && (
                <button className="db-btn db-btn-sm" onClick={() => setStatus(t, "completed")}>
                  <Icon name="check" size={14} /> Done
                </button>
              )}
            </article>
          );
        })}
      </div>

      <h3 className="db-sub">Waiting ({waiting.length})</h3>
      {shownWaiting.length === 0 && <p className="db-empty">Nobody is waiting right now.</p>}
      <ul className="db-wait-list">
        {shownWaiting.map((t) => {
          const elapsed = now - new Date(t.createdAt).getTime();
          const est = (t.estimatedWaitMin ?? 0) * 60000;
          const pct = Math.min(96, (elapsed / (elapsed + est)) * 100);
          const canCancel = isDoctor || t.mine;
          return (
            <li key={t._id} className={`db-wait ${t.mine ? "is-mine" : ""} ${t.priority === "urgent" ? "is-urgent" : ""}`}>
              <span className="db-token">#{t.tokenNumber}</span>
              <div className="db-wait-main">
                <strong>
                  {t.patientName}
                  {t.mine && <em className="db-tag">You</em>}
                  {t.priority === "urgent" && <em className="db-tag db-tag-red">Urgent</em>}
                </strong>
                <span>
                  {t.doctor} · {t.department}
                  {isDoctor && t.reason ? ` · ${t.reason}` : ""}
                </span>
                <div className="db-progress thin" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Wait progress for token ${t.tokenNumber}`}>
                  <i style={{ width: `${pct}%` }} />
                </div>
              </div>
              <div className="db-wait-eta">
                <b>~{t.estimatedWaitMin} min</b>
                <span>#{t.position} in line</span>
              </div>
              {canCancel && !compact && (
                <button className="db-icon-btn" onClick={() => setStatus(t, "cancelled")} aria-label={`Cancel token ${t.tokenNumber}`} title="Cancel token">
                  <Icon name="x" size={15} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
