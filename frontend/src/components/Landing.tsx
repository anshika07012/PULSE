import Icon from "./Icon";

interface Props {
  openAuth: (mode: "login" | "register") => void;
  navigate: (section: string) => void;
}

const services = [
  { number: "01", title: "Patient Assistance", icon: "user", description: "Book an OPD token, follow your place in the queue and check medicine stock from your phone." },
  { number: "02", title: "Doctor Access", icon: "stethoscope", description: "Call the next patient, admit to a bed and update pharmacy stock from one workspace." },
  { number: "03", title: "Hospital Management", icon: "building", description: "Watch beds, wards, pharmacy and waiting rooms on a single live command center." },
  { number: "04", title: "Connected Care", icon: "activity", description: "Shorter waits and fewer surprises, because everyone sees the same live information." },
];

const triage = [
  { icon: "alert", title: "Emergency", text: "Urgent cases jump the queue automatically." },
  { icon: "queue", title: "OPD queue", text: "Live token numbers and wait estimates." },
  { icon: "pill", title: "Pharmacy", text: "Know if a medicine is in stock before you travel." },
  { icon: "bed", title: "Beds and wards", text: "ICU and ward availability, floor by floor." },
];

export default function Landing({ openAuth, navigate }: Props) {
  return (
    <main>
      <section className="pulse-hero" id="home">
        <div className="pulse-cloud-wrap">
          <div className="pulse-cloud">
            <div className="cloud-highlight" />
            <div className="pulse-logo">
              <span className="pulse-word">PULSE</span>
              <span className="medical-cross" aria-label="Medical cross">
                <i />
                <b />
              </span>
            </div>
            <svg className="pulse-ecg" viewBox="0 0 600 100" role="img" aria-label="Heartbeat ECG">
              <path
                d="M5 52 H180 L205 52 L222 35 L242 76 L270 5 L300 94 L330 30 L350 52 H595"
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="cloud-shadow" />
        </div>

        <div className="pulse-hero-copy">
          <h1>Healthcare, connected.</h1>
          <p className="hero-description">
            Patient Unified Logistics and Service Ecosystem: queues, pharmacy, beds and doctors on one live screen.
          </p>
          <div className="hero-actions">
            <button className="button button-dark" onClick={() => openAuth("register")}>
              Get started <span>↗</span>
            </button>
            <button className="button button-outline" onClick={() => navigate("About")}>
              Discover PULSE <span>↓</span>
            </button>
          </div>
        </div>
      </section>

      <section className="about-section section-pad" id="about">
        <div className="section-heading">
          <div>
            <h2>
              Better care starts
              <br />
              with <span>better connection.</span>
            </h2>
          </div>
          <p className="section-intro">
            Healthcare can feel complicated. PULSE brings patients, doctors and hospital services into one simpler
            digital experience.
          </p>
        </div>

        <div className="people-grid">
          <article className="person-card">
            <img src="/images/patient.svg" alt="Patient checking a queue token on a phone" />
            <div className="person-overlay">
              <span>FOR PATIENTS</span>
              <h3>Care that feels closer.</h3>
              <p>See your token, your wait time and medicine availability without standing in line.</p>
            </div>
          </article>
          <article className="person-card">
            <img src="/images/doctor.svg" alt="Doctor with a stethoscope in a hospital corridor" />
            <div className="person-overlay">
              <span>FOR DOCTORS</span>
              <h3>More focus on care.</h3>
              <p>Call the next patient, admit to beds and manage stock without switching tools.</p>
            </div>
          </article>
        </div>

        <div className="values-row">
          <div className="value-item">
            <span className="value-number">01</span>
            <div>
              <h3>People first</h3>
              <p>Designed around real healthcare needs.</p>
            </div>
          </div>
          <div className="value-item">
            <span className="value-number">02</span>
            <div>
              <h3>Simple by design</h3>
              <p>Clear information without unnecessary clutter.</p>
            </div>
          </div>
          <div className="value-item">
            <span className="value-number">03</span>
            <div>
              <h3>Connected care</h3>
              <p>A shared digital space for healthcare services.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="lp-facility">
        <div className="lp-banner">
          <img src="/images/hospital-banner.avif" alt="PULSE hospital building with an ambulance at the entrance" />
          <div className="lp-banner-text">
            <h2>Open around the clock.</h2>
            <p>Emergency, ICU, OPD and pharmacy, all visible in one command center.</p>
          </div>
        </div>
        <div className="lp-triage">
          {triage.map((t) => (
            <div className="lp-triage-item" key={t.title}>
              <span className="lp-triage-icon">
                <Icon name={t.icon} size={22} />
              </span>
              <div>
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="services-section section-pad" id="services">
        <div className="section-heading">
          <div>
            <h2>
              One platform.
              <br />
              <span>Many ways to help.</span>
            </h2>
          </div>
          <p className="section-intro">A central place for the services that make healthcare easier to navigate.</p>
        </div>

        <div className="services-grid">
          {services.map((s) => (
            <article className="service-card" key={s.number}>
              <div className="service-card-top">
                <span>{s.number}</span>
                <span className="service-arrow">↗</span>
              </div>
              <div className="service-icon">
                <Icon name={s.icon} size={24} />
              </div>
              <h3>{s.title}</h3>
              <p>{s.description}</p>
            </article>
          ))}
        </div>

        <div className="service-bottom">
          <p>Healthcare, with fewer barriers.</p>
          <button className="button button-dark" onClick={() => openAuth("register")}>
            Explore PULSE <span>↗</span>
          </button>
        </div>
      </section>

      <section className="final-cta">
        <div className="cta-orb">P</div>
        <h2>Let’s make healthcare simpler.</h2>
        <p>One connected experience for patients, doctors and hospitals.</p>
        <button className="button button-light" onClick={() => openAuth("login")}>
          Open the portal <span>↗</span>
        </button>
      </section>
    </main>
  );
}
