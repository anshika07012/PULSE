# PULSE: Patient Unified Logistics and Service Ecosystem

Full-stack hospital platform: React + TypeScript (Vite) frontend, Node/Express + MongoDB (Mongoose) backend.

## 1. Folder layout

```
pulse/
├── package.json                 root scripts (run both servers together)
├── backend/
│   ├── server.js                Express app + startup
│   ├── .env.example             copy to .env
│   └── src/
│       ├── config/              constants.js (departments, doctors), db.js
│       ├── models/              User, QueueToken, Medicine, Bed
│       ├── middleware/auth.js   JWT + role guard
│       ├── routes/              auth, queue, pharmacy, beds, analytics
│       └── seed.js              demo users, queue, medicines, beds
└── frontend/
    ├── index.html, vite.config.ts, tsconfig.json, package.json
    ├── public/images/           doctor.svg, patient.svg, hospital-banner.svg (swap for real photos)
    └── src/
        ├── App.tsx, main.tsx, api.ts, types.ts
        ├── App.css              <-- PASTE YOUR ORIGINAL App.css HERE
        ├── portal.css           landing extras + role cards + auth form
        ├── dashboard.css        dark slate/teal glass dashboard
        ├── hooks/usePolling.ts  live refresh + 1-second clock
        └── components/
            ├── Icon.tsx, Landing.tsx, AuthPage.tsx
            └── dashboard/ Dashboard, QueueTracker, PharmacyInventory, BedMatrix, Analytics
```

## 2. Run it

Requires Node 18+. The first backend start downloads an embedded MongoDB (needs internet once).

```bash
cd pulse
npm run install:all     # installs root, backend and frontend packages
npm run dev             # API on :5050, web app on :5173
```

Open http://localhost:5173.

Want your own MongoDB (Atlas or local)? Put the connection string in `backend/.env` as `MONGODB_URI=...`.
Otherwise data is stored in `backend/.data` and survives restarts.

## 3. Demo logins (password `demo123`)

| Portal  | Email               |
|---------|---------------------|
| Patient | patient@pulse.demo  |
| Doctor  | doctor@pulse.demo   |

You can also register new patient or doctor accounts. Doctors need a department and a licence ID.

## 4. What each role can do

| Feature | Patient | Doctor |
|---|---|---|
| Book OPD token | yes (one active token) | yes, as walk-in, with urgent priority |
| Cancel token | own waiting token | any token |
| Call next patient / mark done | no | yes (from own department, urgent first) |
| View pharmacy stock | yes | yes, plus dispense, restock, add medicine |
| View bed matrix | yes (names hidden) | yes, plus admit, discharge, mark ready |
| Other patients' names in queue | masked (R*** S***) | visible |

## 5. REST API

All routes except auth need `Authorization: Bearer <token>`.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | /api/auth/register | `{name,email,password,role,phone?,department?,licenseId?}` |
| POST | /api/auth/login | `{email,password,role}`; wrong portal returns 403 |
| GET | /api/auth/me | current user |
| GET | /api/queue | live tokens, positions, estimated waits, stats |
| GET | /api/queue/meta | departments and doctors |
| POST | /api/queue | book a token `{department,doctor,reason?,patientName?,priority?}` |
| POST | /api/queue/call-next | doctor: finish current, call next |
| PATCH | /api/queue/:id/status | `{status:"completed"|"cancelled"}` |
| GET | /api/pharmacy?q= | stock list + summary |
| POST | /api/pharmacy | doctor: add medicine |
| PATCH | /api/pharmacy/:id/stock | doctor: `{delta}` (negative dispenses) |
| GET | /api/beds | beds + per-ward summary |
| POST | /api/beds/admit | doctor: `{ward,patientName}` auto-picks a free bed |
| PATCH | /api/beds/:id | doctor: `{status,patientName?}` |
| GET | /api/analytics | hourly waits + department congestion |

## 6. Using real photos

Put your images in `frontend/public/images/` and change the `src` paths in `Landing.tsx` (patient/doctor cards,
hospital banner) and in `AuthPage.tsx` (the `COPY` object at the top).
