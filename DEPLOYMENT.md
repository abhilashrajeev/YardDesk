# Deploying YardDesk

The database (Neon Postgres) is already cloud-hosted — deploying the app never touches
your data. These steps stand up the backend (Render) and frontend (Vercel) so you can
test against a live URL.

## 1. Backend — Render

1. Go to [render.com](https://render.com) → New → Blueprint, connect the
   `abhilashrajeev/YardDesk` GitHub repo. Render will read `render.yaml` at the repo
   root and pre-fill the service.
2. Before the first deploy, set these env vars in the Render dashboard (the blueprint
   leaves `DATABASE_URL` blank on purpose — never commit real secrets to git):
   - `DATABASE_URL` — your Neon connection string (same one from `backend/.env`, or a
     separate Neon branch if you want production isolated from your dev data — see
     Neon dashboard → Branches → Create branch).
   - `JWT_SECRET` / `JWT_REFRESH_SECRET` — the blueprint auto-generates these; leave
     as-is unless you want to set your own.
3. Deploy. Render runs `npx prisma migrate deploy` automatically before each deploy
   (see `preDeployCommand` in `render.yaml`) — safe, non-destructive, non-interactive.
4. First deploy only: if this is a fresh database (no existing owner account), run the
   seed script once, pointed at the production `DATABASE_URL`:
   ```
   cd backend
   DATABASE_URL="<paste production URL>" npm run db:seed
   ```
   Skip this if you're reusing your existing dev database — it already has your owner
   account.
5. Note the backend's public URL (e.g. `https://yarddesk-api.onrender.com`) — you need
   it for step 2.

## 2. Frontend — Vercel

1. Go to [vercel.com](https://vercel.com) → New Project, import the same GitHub repo.
2. Set **Root Directory** to `web` (Vercel should also pick up `web/vercel.json`
   automatically once the root directory is set).
3. Add an env var: `VITE_API_URL` = `https://<your-render-backend-url>/api`.
4. Deploy. Vercel gives you an HTTPS URL by default — required for the PWA install
   prompt and service worker to work.

## 3. Test it

- Open the Vercel URL, log in with your existing credentials (or the seeded owner
  account), and confirm data loads.
- On mobile, check that the browser offers "Install app" / "Add to Home Screen".

## Ongoing changes (no redeploy ritual, no data loss)

- The database is never part of a deploy — it's a separate Neon instance. Redeploying
  the backend or frontend never touches it.
- Both Render and Vercel auto-deploy on every `git push` to `master` once connected —
  no manual redeploy steps for future fixes.
- Keep developing against your local `.env` (dev DB or a Neon branch), never directly
  against the production `DATABASE_URL`.
- Schema changes: keep using `prisma migrate dev` locally to generate migrations, commit
  them, and let Render's `preDeployCommand` (`prisma migrate deploy`) apply them in
  production automatically. Never run `migrate dev` against production.
