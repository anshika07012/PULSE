import type { AnalyticsResponse } from "../../types";
import Icon from "../Icon";

interface Props {
  data: AnalyticsResponse | null;
}

const level = (pct: number) => (pct >= 85 ? "red" : pct >= 60 ? "amber" : "green");

function Spark({ values, tone }: { values: number[]; tone: string }) {
  const w = 84;
  const h = 26;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / 100) * (h - 4) - 2}`).join(" ");
  return (
    <svg className={`spark ${tone}`} viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      <polyline points={pts} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WaitChart({ hourly }: { hourly: AnalyticsResponse["hourly"] }) {
  const W = 640, H = 250, L = 38, R = 16, T = 18, B = 34;
  const max = Math.max(45, Math.ceil(Math.max(...hourly.map((p) => p.avgWait)) / 15) * 15);
  const x = (i: number) => L + (i / (hourly.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / max) * (H - T - B);
  const pts = hourly.map((p, i) => [x(i), y(p.avgWait)] as const);
  const nowIdx = hourly.findIndex((p) => p.isNow);
  const split = nowIdx >= 0 ? nowIdx : hourly.length - 1;

  const line = (arr: (readonly [number, number])[]) => arr.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const past = pts.slice(0, split + 1);
  const future = pts.slice(split);
  const area = `${line(past)} L${past[past.length - 1][0]} ${H - B} L${past[0][0]} ${H - B} Z`;
  const ticks = [0, max / 3, (2 * max) / 3, max].map(Math.round);

  return (
    <svg className="wait-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Average OPD waiting time by hour of the day">
      <defs>
        <linearGradient id="waitFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2dd4bf" stopOpacity=".4" />
          <stop offset="1" stopColor="#2dd4bf" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
          <text x={L - 8} y={y(t) + 4} textAnchor="end" className="axis">{t}m</text>
        </g>
      ))}
      <path d={area} fill="url(#waitFill)" />
      <path d={line(past)} className="wait-line" fill="none" />
      {future.length > 1 && <path d={line(future)} className="wait-line forecast" fill="none" />}
      {hourly.map((p, i) => (
        <g key={p.label}>
          {i % 2 === 0 && <text x={x(i)} y={H - 10} textAnchor="middle" className="axis">{p.label}</text>}
          {p.isNow && (
            <>
              <line x1={x(i)} x2={x(i)} y1={T} y2={H - B} className="now-line" />
              <circle cx={x(i)} cy={y(p.avgWait)} r={6} className="now-dot" />
              <text x={x(i)} y={y(p.avgWait) - 12} textAnchor="middle" className="now-label">Now · {p.avgWait}m</text>
            </>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function Analytics({ data }: Props) {
  return (
    <section className="db-card" id="module-analytics" aria-labelledby="analytics-title">
      <header className="db-card-head">
        <div>
          <h2 id="analytics-title">
            <Icon name="chart" size={20} /> Analytics and congestion
          </h2>
          <p>Waiting time through the day and how busy each department is right now.</p>
        </div>
      </header>

      {!data ? (
        <p className="db-empty">Loading analytics…</p>
      ) : (
        <>
          <div className="db-chips">
            <div><b>{data.kpis.avgWait} min</b><span>average wait now</span></div>
            <div><b>{data.kpis.peakHour}</b><span>typical peak hour</span></div>
            <div><b>{data.kpis.busiest}</b><span>busiest department</span></div>
          </div>

          <div className="db-analytics">
            <div>
              <h3 className="db-sub">Average wait by hour</h3>
              <WaitChart hourly={data.hourly} />
              <p className="chart-note">Solid line is today so far, dashed line is the usual pattern for the rest of the day.</p>
            </div>
            <div>
              <h3 className="db-sub">Department congestion</h3>
              <ul className="cong-list">
                {data.departments.map((d) => {
                  const lv = level(d.congestion);
                  return (
                    <li key={d.name}>
                      <div className="cong-row">
                        <span>{d.name}</span>
                        <b className={lv}>{d.congestion}%</b>
                      </div>
                      <div className="cong-bar">
                        <div className="db-progress thin">
                          <i className={lv} style={{ width: `${d.congestion}%` }} />
                        </div>
                        <Spark values={d.trend} tone={lv} />
                      </div>
                      <small>
                        {d.active} of {d.capacity} OPD slots in use
                      </small>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
