# Encontro Pirituba

Base de marketplace local com **Next.js + TypeScript + Tailwind + Supabase**.

## Stack

- Frontend: Next.js (App Router), React, TypeScript
- UI: Tailwind CSS com tokens personalizados de azul
- Estado/fetching: TanStack Query
- Formulários: react-hook-form
- Backend/Auth/DB/Storage/Functions: Supabase
- Testes: Vitest (unit/snapshot) + Playwright (E2E)
- Qualidade: ESLint + Prettier + Husky + lint-staged
- CI: GitHub Actions

## Tokens de tema (Tailwind)

- `blue.500`: `#1E7BF6`
- `blue.900`: `#0B3D91`
- `accent`: `#0A84FF`
- `white`: `#FFFFFF`
- `graytext`: `#4B5563`

## Rotas principais

- `/`
- `/search`
- `/estabelecimento/[id]`
- `/profissional/[id]`
- `/voucher/[id]`
- `/dashboard`
- `/admin/review`

## Estrutura

- `src/components/atoms`
- `src/components/molecules`
- `src/components/organisms`
- `src/hooks`
- `src/lib/supabase`
- `supabase/migrations`
- `supabase/functions`

## Banco e segurança

A migração inicial está em `supabase/migrations/20260221_initial.sql` com:

- Tabelas: profiles, professional_profiles, establishment_profiles, allowed_ceps, services, vouchers, bookings, reviews, favorites
- Enums: roles, booking status, discount type, target type
- Índices em CEP, aprovação, datas e localização (lat/lng)
- RLS habilitado com políticas base por dono/admin/contexto
- RPC `reserve_voucher_atomic` para reserva com decremento de estoque atômico

## Edge Functions

- `validate_cep`: valida CEP em allowlist + consulta ViaCEP
- `reserve_voucher`: proxy para RPC atômica
- `get_allowed_ceps`: API administrativa da allowlist
- `send_notification`: template para e-mail/WhatsApp

## Configuração local

1. Copie `.env.local.example` para `.env.local`.
2. Preencha variáveis públicas do Supabase para o app web:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

3. Banners da home (carrossel):

- `public/images/banners/hero-banner-1.jpg`
- `public/images/banners/hero-banner-2.jpg`
- `public/images/banners/hero-banner-3.jpg`

4. Logo do sidenav:

- `public/images/logo/encontro-pirituba-logo.png`

5. Instale dependências:

```bash
npm install
```

6. Rode o app:

```bash
npm run dev
```

## Testes e qualidade

```bash
npm run lint
npm run typecheck
npm run test
npm run test:e2e
```

## Deploy

- Frontend: Vercel
- Backend: Supabase

## Observação de negócio

Somente perfis de **profissionais e estabelecimentos** com CEP permitido na `allowed_ceps` podem ser aprovados. Clientes podem ser de qualquer CEP.
