# Zana Backend (local)

Backend local em Node/Express + Postgres (via Prisma).

## Requisitos

- Node.js
- Postgres local **ou** Docker Desktop (recomendado)

## Postgres via Docker

Na raiz do repo:

- `docker compose up -d` (sobe em `localhost:5433` para evitar conflito com Postgres local)

## Setup

Em `backend/`:

1. Copie `backend/.env.example` para `backend/.env`
2. Opcionalmente crie `backend/.env.local` a partir de `backend/.env.local.example` para overrides locais (não comitar).
3. Instale deps: `npm.cmd --prefix backend install`
4. Gere o client: `npm.cmd --prefix backend run prisma:generate`
5. Migre: `npm.cmd --prefix backend run prisma:migrate`
6. Seed (opcional): `npm.cmd --prefix backend run prisma:seed`
7. Rode: `npm.cmd --prefix backend run dev`

## Endpoints

- `GET /health`
- `GET /api/products`
- `GET /api/products/:id`
- `POST /api/products`
- `PATCH /api/products/:id`
- `DELETE /api/products/:id`

## Se ja existe Postgres na sua maquina

Se voce ja tem Postgres rodando em `localhost:5432` com outras credenciais, ajuste o `DATABASE_URL` em `backend/.env`
para o usuario/senha/porta corretos.
