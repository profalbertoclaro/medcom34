# MedCom ERP

Mini ERP web responsivo para Comissão de Formatura de Medicina, focado em transparência financeira, governança, prestação de contas, inadimplência, contratos, eventos e auditoria.

## Como abrir

Abra `index.html` no navegador ou rode um servidor local:

```bash
python3 -m http.server 4173
```

Depois acesse `http://localhost:4173`.

## Acessos de demonstração

Senha de todos os perfis: `med2026`.

- `admin@medcom.local` - Administrador
- `presidencia@medcom.local` - Presidente da Comissão
- `tesouraria@medcom.local` - Tesoureiro
- `fiscal@medcom.local` - Conselho Fiscal
- `aluna@medcom.local` - Formando
- `auditoria@medcom.local` - Auditor

## O que está implementado

- Autenticação local com token JWT demonstrativo.
- Controle de permissões por perfil.
- Dashboard executivo com saldo, receitas, despesas, inadimplência, meta, próximos vencimentos e alertas inteligentes.
- Gestão financeira com receitas, despesas, transferências, ajustes, estornos e reembolsos.
- Plano de contas com categorias, subcategorias, tags e centros de custo obrigatórios.
- Gestão de formandos com parcelas, inadimplência, acordos e recibos.
- Eventos com orçamento previsto x realizado, fornecedores, contratos e checklist.
- Fornecedores com contratos, parcelas, anexos e histórico.
- Fluxo de caixa realizado e projetado.
- Relatórios com DRE simplificada, CSV, Excel via CSV e impressão/PDF.
- Auditoria com autor, ação, entidade, data, antes/depois e exportação.
- Dark mode, PWA e persistência em `localStorage`.
- Tela administrativa para editar identidade da comissão, administradora, meta, multa/juros e limpar dados de teste.

## Primeiro uso real

Entre como `admin@medcom.local`, abra **Configurações** e preencha:

- nome da comissão;
- nome e email da administradora;
- meta de arrecadação;
- multa e juros.

Depois use **Limpar dados de teste** para remover formandos, lançamentos, eventos e fornecedores de demonstração. A limpeza exige digitar `LIMPAR` e preserva categorias, centros de custo e o usuário administrador.

## Backend e banco

O arquivo `prisma/schema.prisma` contém a modelagem PostgreSQL preparada para a versão Node.js/Prisma, incluindo:

- usuários e perfis;
- formandos, planos e parcelas;
- lançamentos financeiros;
- categorias e centros de custo;
- fornecedores, contratos e anexos;
- eventos e checklist;
- notificações;
- auditoria;
- tags e contas bancárias.

Veja também `docs/architecture.md` para a proposta de evolução para Next.js, Node.js, Prisma, PostgreSQL, storage de anexos e autenticação de produção.

## Observação técnica

Esta entrega é uma versão estática funcional porque o workspace não possui `npm` instalado. Ela pode ser usada imediatamente como protótipo navegável e servir como base visual/funcional para migração para Next.js, TailwindCSS, Shadcn/UI, Recharts, Node.js, Prisma e PostgreSQL.
