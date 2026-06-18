# GestECC

Sistema de gestão escolar para organização da rotina da ETEC: login da gestão, solicitação/aprovação de professores, mural de avisos, status de salas, substituições, horários, reservas e perfil do professor.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- Supabase/Postgres
- Vercel

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```bash
NEXT_PUBLIC_SUPABASE_URL="https://gmjkxiajawtymnxptzar.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="chave-publica-anon-ou-publishable"
SUPABASE_SERVICE_ROLE_KEY="chave-service-role-do-dashboard"
GESTECC_MANAGER_USERNAME="ETECMAS@GESTÃO-GESTEC"
GESTECC_MANAGER_PASSWORD="senha-da-gestao"
GESTECC_SESSION_SECRET="string-longa-aleatoria"
```

Sem `SUPABASE_SERVICE_ROLE_KEY`, o app roda em modo local de desenvolvimento com dados em memória. Para produção no Vercel, essa chave é obrigatória porque as rotas `/api` fazem as operações seguras no Supabase pelo servidor.

## Supabase

Projeto criado: `GESTECC`

- Project ref: `gmjkxiajawtymnxptzar`
- URL: `https://gmjkxiajawtymnxptzar.supabase.co`
- Região: `sa-east-1`

O schema está em `supabase/schema.sql` e já inclui:

- `teacher_requests`
- `teachers`
- `rooms`
- `notices`
- `substitutions`
- `schedules`
- `reservations`
- `notifications`

Todas as tabelas têm RLS ativo. O acesso direto de `anon/authenticated` fica negado por política; o app usa rotas server-side do Next.js com `service_role`.

## Login da gestão

Configure as credenciais nas variáveis:

- `GESTECC_MANAGER_USERNAME`
- `GESTECC_MANAGER_PASSWORD`

O cadastro de professores é sempre solicitado pelo formulário público e aprovado/recusado no painel da gestão.

## Verificação

```bash
npm run lint
npm run build
```
