# Fitness Club Management System

A React + Vite frontend and Node.js + Express API for managing an existing fitness-club graph in Neo4j Aura. The application reads live records and performs parameterized CRUD and relationship operations. It contains no seed data, reset command, or database deletion script.

## Project structure

- `frontend/` - responsive React/Vite dashboard
- `backend/` - Express REST API and official Neo4j JavaScript driver

## Requirements

- Node.js 18 or newer
- A populated Neo4j Aura database

## Setup

Open two PowerShell terminals from the repository root. Do not put Aura credentials in the frontend.

```powershell
cd .\fitness-club-management\backend
Copy-Item .env.example .env
notepad .env
npm install
npm run dev
```

Set `NEO4J_URI`, `NEO4J_USERNAME`, and `NEO4J_PASSWORD` in `backend/.env`. Credentials stay in the backend and are never sent to React. `backend/.env` is ignored by Git.

In the second terminal:

```powershell
cd .\fitness-club-management\frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The backend health check is available at **http://localhost:4000/api/health**. The Vite development proxy forwards `/api` calls to the backend.

## Implemented features

- Live dashboard counts for members, plans, trainers, sessions, payments, and relationships.
- Members, membership plans, trainers, workout sessions, and payments: live search, create, edit, and safe delete.
- Membership plan assignment with `HAS_PLAN`.
- Trainer/session linking with `CONDUCTS`.
- Attendance entry and attendance history with `ATTENDS`.
- Payment entry and member payment linking with `MADE_PAYMENT`.
- Relationship inspection and removal for the four supported relationship types.
- Input validation for supported properties and numeric fields.

## API overview

The backend exposes:

- `GET /api/health`, `GET /api/dashboard`, and `GET /api/schema`
- `GET`, `POST`, `PATCH`, and protected `DELETE` `/api/members`, `/api/plans`, `/api/trainers`, `/api/sessions`, and `/api/payments`
- `GET`, `POST`, and `DELETE` `/api/relationships`

Resource deletion is refused when the node still has relationships. This prevents accidental loss of connected records. Relationship types and endpoint labels are allowlisted, and all property values are passed as Cypher parameters.

## Database behavior

The API uses parameterized Cypher queries and the existing labels `Member`, `MembershipPlan`, `Trainer`, `WorkoutSession`, and `Payment`. `/api/schema` reads the live property schema from Neo4j. CRUD forms use only common properties and preserve unknown existing properties when editing. A record can only be deleted when it has no relationships; this avoids accidentally deleting connected data. Duplicate relationships are rejected.

The app supports these relationship types from the existing graph: `HAS_PLAN`, `CONDUCTS`, `ATTENDS`, and `MADE_PAYMENT`. Existing unknown properties are not removed when a supported property is edited. No existing node or relationship is reset, seeded, or bulk-deleted.

## Troubleshooting

- **Database offline:** verify that `backend/.env` exists, the Aura URI starts with `neo4j+s://`, the credentials are correct, and your Aura instance is running.
- **CORS or API errors:** start the backend on port 4000 before opening the Vite site. If using a different port, update `FRONTEND_ORIGIN` and the Vite proxy.
- **Empty tables:** inspect `/api/schema` and the Aura Browser to confirm labels and properties. The app intentionally does not invent or seed records.
- **PowerShell execution policy:** use `npm.cmd install` / `npm.cmd run dev` if your machine blocks `npm.ps1`.
- **Before testing:** install Node.js 18 or newer, run the two `npm install` commands above, then use `npm.cmd run build` in `frontend` to verify the production bundle.

## Deploy with Render

The repository includes `render.yaml` for deploying the backend as a Render web service. The frontend can be deployed separately on Vercel.

1. In Render, choose **New > Blueprint** and connect `yashvini-chirri/pulsepoint`.
2. Enter these values for the `pulsepoint-api` service:
   - `NEO4J_URI`
   - `NEO4J_USERNAME`
   - `NEO4J_PASSWORD`
   - `FRONTEND_ORIGIN` - your Vercel URL, for example `https://pulsepoint.vercel.app`
3. Render builds and deploys the API. Credentials remain only in Render environment variables.
4. In Vercel, add the environment variable `VITE_API_URL` with the Render API URL including `/api`, for example `https://pulsepoint-api.onrender.com/api`, then redeploy the frontend.

The first deployment can take a few minutes. The backend health URL will be:
`https://pulsepoint-api.onrender.com/api/health` (or the custom URL Render assigns).
