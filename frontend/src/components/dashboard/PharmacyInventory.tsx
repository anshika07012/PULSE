import { useMemo, useState, type FormEvent } from "react";
import { api } from "../../api";
import type { Notify, PharmacyResponse, User } from "../../types";
import Icon from "../Icon";

interface Props {
  data: PharmacyResponse | null;
  user: User;
  notify: Notify;
  reload: () => Promise<void>;
  compact?: boolean;
}

const LABEL = { in: "In stock", low: "Low stock", out: "Out of stock" } as const;
const RANK = { out: 0, low: 1, in: 2 } as const;

export default function PharmacyInventory({ data, user, notify, reload, compact }: Props) {
  const isDoctor = user.role === "doctor";
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", category: "", stock: "50", minStock: "20", price: "" });

  const items = useMemo(() => {
    let list = data?.items ?? [];
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((m) => [m.name, m.genericName, m.category].some((v) => v?.toLowerCase().includes(q)));
    }
    if (filter === "low") list = list.filter((m) => m.status === "low");
    if (filter === "out") list = list.filter((m) => m.status === "out");
    list = [...list].sort((a, b) => RANK[a.status] - RANK[b.status] || a.name.localeCompare(b.name));
    return compact ? list.slice(0, 6) : list;
  }, [data, query, filter, compact]);

  async function adjust(id: string, delta: number) {
    try {
      const m = await api.adjustStock(id, delta);
      notify(`${m.name}: ${delta > 0 ? "restocked" : "dispensed"}, ${m.stock} ${m.unit} now.`);
      await reload();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not update stock.", "error");
    }
  }

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try {
      await api.addMedicine({ ...form, stock: Number(form.stock), minStock: Number(form.minStock), price: Number(form.price) });
      notify(`${form.name} added to the pharmacy.`);
      setForm({ name: "", category: "", stock: "50", minStock: "20", price: "" });
      setAdding(false);
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : "Could not add medicine.", "error");
    }
  }

  const s = data?.summary;

  return (
    <section className="db-card" id="module-pharmacy" aria-labelledby="pharmacy-title">
      <header className="db-card-head">
        <div>
          <h2 id="pharmacy-title">
            <Icon name="pill" size={20} /> Drug and pharmacy inventory
          </h2>
          <p>
            {s ? `${s.total} medicines tracked · ${s.low} low · ${s.out} out of stock` : "Loading stock levels…"}
          </p>
        </div>
        {isDoctor && !compact && (
          <button className="db-btn" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>
            <Icon name={adding ? "x" : "plus"} size={16} /> Add medicine
          </button>
        )}
      </header>

      {adding && (
        <form className="db-form" onSubmit={add}>
          <label>
            Medicine name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </label>
          <label>
            Category
            <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Antibiotic" required />
          </label>
          <label>
            Opening stock
            <input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </label>
          <label>
            Low-stock level
            <input type="number" min={0} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} />
          </label>
          <label>
            Price (₹)
            <input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} required />
          </label>
          <button className="db-btn db-btn-primary" type="submit">
            Save medicine
          </button>
        </form>
      )}

      {!compact && (
        <div className="db-toolbar">
          <label className="db-search">
            <Icon name="search" size={16} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by medicine, generic name or category" aria-label="Search medicines" />
          </label>
          <div className="db-seg" role="group" aria-label="Filter by stock status">
            {(["all", "low", "out"] as const).map((f) => (
              <button key={f} className={filter === f ? "on" : ""} onClick={() => setFilter(f)}>
                {f === "all" ? "All" : f === "low" ? "Low stock" : "Out of stock"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="db-table-wrap">
        <table className="db-table">
          <thead>
            <tr>
              <th>Medicine</th>
              {!compact && <th>Category</th>}
              <th>Stock</th>
              {!compact && <th>Price</th>}
              <th>Status</th>
              {isDoctor && !compact && <th aria-label="Actions" />}
            </tr>
          </thead>
          <tbody>
            {items.map((m) => {
              const pct = Math.min(100, (m.stock / Math.max(1, m.minStock * 3)) * 100);
              return (
                <tr key={m._id}>
                  <td>
                    <strong>{m.name}</strong>
                    {m.genericName && <small>{m.genericName}</small>}
                  </td>
                  {!compact && <td>{m.category}</td>}
                  <td>
                    <div className="db-stock">
                      <div className="db-progress thin">
                        <i className={m.status} style={{ width: `${pct}%` }} />
                      </div>
                      <span>
                        {m.stock} {m.unit}
                      </span>
                    </div>
                  </td>
                  {!compact && <td>₹{m.price}</td>}
                  <td>
                    <span className={`db-pill ${m.status}`}>{LABEL[m.status]}</span>
                  </td>
                  {isDoctor && !compact && (
                    <td className="db-row-actions">
                      <button className="db-btn db-btn-sm" onClick={() => adjust(m._id, -1)} disabled={m.stock === 0} aria-label={`Dispense one ${m.name}`}>
                        <Icon name="minus" size={13} /> Dispense
                      </button>
                      <button className="db-btn db-btn-sm" onClick={() => adjust(m._id, 25)} aria-label={`Restock 25 of ${m.name}`}>
                        <Icon name="plus" size={13} /> 25
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="db-empty">
                  No medicines match. Clear the search or filter to see everything.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
