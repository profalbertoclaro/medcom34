# MeuDinDin

Aplicativo financeiro pessoal gratuito, em português do Brasil, criado com React Native, Expo, TypeScript e Supabase.

Esta primeira entrega foca no MVP estrutural: navegação, tema claro/escuro, autenticação, schema Supabase/PostgreSQL, telas principais e formulários iniciais para contas, cartões, categorias, centros de custo e transações.

## Stack

- React Native com Expo
- TypeScript
- Supabase Auth
- Supabase/PostgreSQL
- React Navigation
- Zustand
- Interface responsiva para web e iPhone
- Tema claro, escuro e automático pelo sistema

## Estrutura

```text
.
├── App.tsx
├── app.json
├── package.json
├── src
│   ├── app
│   ├── components
│   ├── config
│   ├── data
│   ├── hooks
│   ├── lib
│   ├── navigation
│   ├── screens
│   ├── services
│   ├── stores
│   ├── theme
│   ├── types
│   └── utils
└── supabase
    ├── config.toml
    ├── schema.sql
    └── seed.sql
```

## Configurar o Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Rode `supabase/schema.sql`.
4. Rode `supabase/seed.sql`.
5. Em Authentication, mantenha Email/Password habilitado.
6. Copie a Project URL e a anon public key.
7. Crie um arquivo `.env` baseado em `.env.example`:

```bash
EXPO_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

O schema ativa Row Level Security e cria políticas para que cada usuário acesse apenas seus próprios dados. Ao cadastrar um usuário, o trigger `handle_new_user` cria o perfil e insere categorias e centros de custo padrão.

## Rodar localmente

Instale Node.js com npm disponível no PATH. Depois:

```bash
npm install
npm run start
```

Para web:

```bash
npm run web
```

Para iPhone com Expo Go:

```bash
npm run start
```

Depois escaneie o QR Code pelo app Expo Go no iPhone. O iPhone e o computador precisam estar na mesma rede.

## Publicar na web

Gere uma build estática:

```bash
npx expo export --platform web
```

Publique a pasta `dist` em um host estático, como Vercel, Netlify, Cloudflare Pages ou Supabase Storage. Configure as mesmas variáveis `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` no ambiente de build.

## Telas disponíveis

- Login
- Cadastro
- Recuperação de senha
- Dashboard
- Transações
- Nova transação
- Contas
- Nova conta
- Cartões
- Novo cartão
- Faturas
- Categorias e subcategorias
- Centros de custo
- Importar histórico
- Conciliação bancária
- Conciliação de cartão
- Relatórios
- Configurações
- Perfil do usuário

## Escopo desta etapa

Implementado:

- Estrutura Expo/TypeScript
- Navegação autenticada e não autenticada
- Tema claro/escuro
- Supabase Auth
- Cliente Supabase
- Stores com Zustand
- Serviços de banco
- Schema SQL completo com RLS
- Seed de moedas e tipos de conta
- Trigger de perfil e dados padrão por usuário
- Telas principais do MVP

Ainda não implementado nesta etapa:

- Open Finance
- Integrações bancárias automáticas
- OCR
- IA
- Parser completo de CSV/XLS/XLSX
- OFX

Esses pontos ficam como evolução futura, como solicitado.
