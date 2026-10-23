import { useMemo, useState, type CSSProperties } from "react";
import { api } from "../../api";
import type { Bed, BedsResponse, Notify, User } from "../../types";
import Icon from "../Icon";

interface Props {
  data: BedsResponse | null;
  user: User;
  notify: Notify;
  reload: () => Promise<void>;
  compact?: boolean;
  onOpen?: () => void;
}

const level = (pct: number) => (pct >= 85 ? "red" : pct >= 60 ? "amber" : "green");
const levelText = { red: "Critical", amber: "Busy", green: "Open" } as const;

function since(iso?: string) {
  if (!iso) return "";
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export default function BedMatrix({ data, user, notify, reload, compact, onOpen }: Props) {
  const isDoctor = user.role === "doctor";
  const [floor, setFloor] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");

  const beds = data?.beds ?? [];
  const wards = data?.summary.byWard ?? [];
  const floors = useMemo(() => [...new Set(beds.map((b) => b.floor))].sort((a, b) => b - a), [beds]);
  const activeFloor = floor ?? (floors.includes(3) ? 3 : floors[0] ?? 1);
  const selected = beds.find((b) => b._id === selectedId) ?? null;

  const floorStats = (f: number) => {
    const list = beds.filter((b) => b.floor === f);
    const occ = list.filter((b) => b.status === "occupied").length;
    return { list, pct: list.length ? Math.round((occ / list.length) * 100) : 0, free: list.filter((b) => b.status === "available").length };
  };

  async function run(action: () => Promise<BedsResponse>, ok: string) {
    try {
      await action();
      notify(ok);
      setName("");
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not update the bed.", "error");
    }
  }

  function quickAdmit(ward: string) {
    const free = beds.find((b) => b.ward === ward && b.status === "available");
    if (!free) return notify(`${ward} has no free beds.`, "error");
    setSelectedId(free._id);
  }

  const s = data?.summary;

  return (
    <section className="db-card" id="module-beds" aria-labelledby="beds-title">
      <header className="db-card-head">
        <div>
          <h2 id="beds-title">
            <Icon name="bed" size={20} /> Bed availability and ward matrix
          </h2>
          <p>{s ? `${s.available} free · ${s.occupied} occupied · ${s.cleaning} being cleaned · ${s.occupancy}% full` : "Loading beds…"}</p>
        </div>
        {compact && onOpen && (
          <button className="db-btn" onClick={onOpen}>
            Open ward matrix
          </button>
        )}
      </header>

      <div className="db-legend" aria-label="Legend">
        <span><i className="dot green" /> Available</span>
        <span><i className="dot red" /> Occupied</span>
        <span><i className="dot amber" /> Being cleaned</span>
      </div>

      <div className={`db-beds-layout ${compact ? "is-compact" : ""}`}>
        {/* 3D floor stack */}
        <div className="floor-stack" aria-label="Hospital floors">
          {floors.map((f, i) => {
            const st = floorStats(f);
            return (
              <button
                key={f}
                className={`floor-slot ${f === activeFloor ? "active" : ""}`}
                style={{ "--i": i } as CSSProperties}
                onClick={() => setFloor(f)}
                aria-label={`Floor ${f}, ${st.pct}% occupied, ${st.free} free beds`}
              >
                <span className="floor-plate">
                  {st.list.map((b) => (
                    <i key={b._id} className={`cell ${b.status}`} />
                  ))}
                </span>
                <span className="floor-tag">
                  <b>Floor {f}</b>
                  <em className={level(st.pct)}>{st.pct}%</em>
                </span>
              </button>
            );
          })}
        </div>

        {/* Ward matrix */}
        <div className="ward-matrix">
          {wards
            .filter((w) => compact || w.floor === activeFloor)
            .sort((a, b) => b.floor - a.floor)
            .map((w) => {
              const lv = level(w.occupancy);
              const wardBeds = beds.filter((b) => b.ward === w.ward);
              return (
                <article className="ward" key={w.ward}>
                  <header>
                    <div>
                      <strong>{w.ward}</strong>
                      <small>
                        Floor {w.floor} · {w.type}
                      </small>
                    </div>
                    <span className={`db-pill ${lv}`}>
                      {levelText[lv]} · {w.occupancy}%
                    </span>
                  </header>
                  <div className="db-progress">
                    <i className={lv} style={{ width: `${w.occupancy}%` }} />
                  </div>
                  <p className="ward-count">
                    {w.occupied}/{w.total} occupied · {w.available} free
                  </p>
                  {!compact && (
                    <>
                      <div className="bed-grid">
                        {wardBeds.map((b: Bed) => (
                          <button
                            key={b._id}
                            className={`bed ${b.status} ${b._id === selectedId ? "sel" : ""}`}
                            onClick={() => setSelectedId(b._id === selectedId ? null : b._id)}
                            aria-label={`Bed ${b.label}, ${b.status}`}
                            title={`${b.label} · ${b.status}`}
                          >
                            <Icon name="bed" size={15} />
                            <span>{b.label.split("-")[1]}</span>
                          </button>
                        ))}
                      </div>
                      {isDoctor && (
                        <button className="db-btn db-btn-sm" onClick={() => quickAdmit(w.ward)} disabled={w.available === 0}>
                          <Icon name="plus" size={13} /> Admit patient
                        </button>
                      )}
                    </>
                  )}
                </article>
              );
            })}
        </div>
      </div>

      {!compact && selected && (
        <div className="bed-inspector" role="region" aria-label="Selected bed">
          <div>
            <strong>
              Bed {selected.label} · {selected.ward}
            </strong>
            <span className={`db-pill ${selected.status === "available" ? "green" : selected.status === "occupied" ? "red" : "amber"}`}>
              {selected.status === "available" ? "Available" : selected.status === "occupied" ? "Occupied" : "Being cleaned"}
            </span>
            {selected.status === "occupied" && isDoctor && (
              <small>
                {selected.patientName} · admitted {since(selected.since)} ago
              </small>
            )}
          </div>

          {isDoctor ? (
            <div className="db-actions">
              {selected.status === "available" && (
                <>
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Patient name" aria-label="Patient name" />
                  <button className="db-btn db-btn-primary" onClick={() => run(() => api.setBed(selected._id, "occupied", name), `Bed ${selected.label} assigned.`)} disabled={name.trim().length < 2}>
                    Admit to this bed
                  </button>
                </>
              )}
              {selected.status === "occupied" && (
                <button className="db-btn" onClick={() => run(() => api.setBed(selected._id, "cleaning"), `${selected.patientName} discharged. Bed ${selected.label} sent for cleaning.`)}>
                  Discharge patient
                </button>
              )}
              {selected.status === "cleaning" && (
                <button className="db-btn db-btn-primary" onClick={() => run(() => api.setBed(selected._id, "available"), `Bed ${selected.label} is ready.`)}>
                  <Icon name="check" size={15} /> Mark as ready
                </button>
              )}
            </div>
          ) : (
            <small>Bed assignments are managed by the hospital team.</small>
          )}
        </div>
      )}
    </section>
  );
}
