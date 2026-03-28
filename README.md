## Zana (Frontend + Backend local)

Este repo tem:

- Frontend em Vite/React (raiz do projeto)
- Backend local em Node/Express + Postgres (pasta `backend/`)

### Pré-requisitos

- Node.js
- Docker Desktop (opcional, para subir o Postgres via `docker compose`)

## Frontend (Vite)

1. Instale deps na raiz: `npm install`
2. Crie o `.env.local` a partir do template: copie `.env.local.example` → `.env.local`
3. Rode o front:
   - Windows (PowerShell com scripts bloqueados): `npm.cmd run dev`
   - Outros: `npm run dev`

O Vite sobe em `http://localhost:5173` e faz proxy de `/api` e `/health` para `http://localhost:3001` (veja `vite.config.js`).

## Backend local + Postgres (opcional)

Este repo inclui um backend local em `backend/` e Postgres via `docker-compose.yml`.

1. Suba o Postgres: `docker compose up -d` (sobe em `localhost:5433`)
2. Crie `backend/.env` a partir de `backend/.env.example`
3. Instale deps do backend: `npm.cmd --prefix backend install`
4. Gere o client: `npm.cmd --prefix backend run prisma:generate`
5. Rode migrações: `npm.cmd --prefix backend run prisma:migrate`
5. (Opcional) Seed: `npm.cmd --prefix backend run prisma:seed`
6. Suba o backend: `npm.cmd --prefix backend run dev`

Endpoints: `GET /health`, CRUD em `GET/POST/PATCH/DELETE /api/products`

### Credenciais de Admin (painel /admin)

No `backend/.env`:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- (Opcional) `ADMIN_RESET_PASSWORD=true` para forçar reset da senha no próximo boot

Reinicie o backend. Depois faça login em `/conta` com esse utilizador e você será redirecionado para `/admin`.

## Ícones / “Adicionar ao ecrã inicial” (PWA)

- Favicon: `public/favicon.svg`
- Manifest: `public/site.webmanifest`

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)
