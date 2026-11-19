# Redesign do frontend — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever a interface de `packages/web` no estilo claro e minimalista da especificação `docs/superpowers/specs/2026-11-19-redesign-frontend-design.md`, sem alterar comportamento, textos, rotas ou a API.

**Architecture:** Tailwind CSS v4 (plugin Vite) com tokens em variáveis CSS e componentes no padrão shadcn/ui escritos em `src/components/ui/`. O CSS antigo fica numa camada `legacy` de menor prioridade enquanto as telas migram e é removido no fim. `App.tsx` é dividido em layout e páginas antes da troca visual.

**Tech Stack:** React 19, Vite 8, TypeScript 5.9, Tailwind 4.3.5, class-variance-authority, clsx, tailwind-merge, lucide-react, Inter variável (fontsource), Vitest + Testing Library, Playwright.

---

## Decisões que refinam a especificação

- **Sem `radix-ui` nesta entrega.** O inventário das telas não tem diálogos, abas nem menus: só `<select>`, checkbox, `<input type="file">`, `<progress>`, `<details>` e uma `<table>`. Todos ficam nativos e estilizados; botões-link usam `buttonVariants()` aplicado a `<a>`. Isso dispensa `Slot`, portais e polyfills de jsdom. Se uma tarefa precisar de primitivo Radix, adicionar apenas então.
- **Sem `tw-animate-css`**: não há animações de entrada/saída.
- **`lucide-react@1.73.0`**: a versão mais recente (1.76.0) foi publicada hoje e violaria o `minimumReleaseAge` do pnpm 11.
- Componentes shadcn são escritos à mão a partir do padrão do projeto shadcn (sem `shadcn init`), mantendo só as variantes usadas, para não inflar o código não coberto.

## Regras para todas as tarefas

1. **Contrato de teste.** Não mudar texto visível, `aria-label`, `role`, `id`/`htmlFor`, `name` de campos, `href`, ordem lógica de campos em formulários nem mensagens. Se um teste falhar, a causa é a reescrita — corrija o JSX, não o teste. Só altere teste quando a semântica mudou de propósito (registre o motivo no commit) e nunca enfraqueça a asserção.
2. **Lógica intocada.** Estados, efeitos, chamadas `api(...)` e props das telas permanecem iguais; muda só o JSX de apresentação e as classes.
3. **Ícones.** Trocar `<Icon name="x" />` por componentes `lucide-react` com `aria-hidden` (o Lucide já aplica `aria-hidden="true"` por padrão) e `className="size-4"` (ou `size-5`). Mapa: `book→BookOpen`, `grid→LayoutGrid`, `folder→Folder`, `user→User`, `lock→Lock`, `logout→LogOut`, `arrow→ArrowRight`, `back→ArrowLeft`, `search→Search`, `eye→Eye`, `eyeOff→EyeOff`.
4. **Verificação por tarefa:** na raiz, `pnpm --filter @labrary/web test` e `pnpm --filter @labrary/web build` verdes antes do commit; captura de tela da tela migrada em 1440px e 390px com o servidor de desenvolvimento (`pnpm dev`, conta `professor@labrary.local` / `aluno@labrary.local` / `avaliador@labrary.local`, senha local do seed em `docs/hu01.md`).
5. **Commits** em português no padrão `style(web): ...`/`refactor(web): ...`, com a linha `Co-Authored-By` exigida.

## Receitas visuais (usar em todas as telas)

| Elemento | Classes |
| --- | --- |
| Cabeçalho de página | `<header className="mb-8 flex flex-wrap items-end justify-between gap-4">` com `<p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">` (eyebrow), `<h1 className="text-2xl font-semibold tracking-tight md:text-[28px]">`, `<p className="mt-1 text-sm text-muted-foreground">` |
| Seção / painel | `Card` (`rounded-xl border bg-card`), cabeçalho `CardHeader` + `CardTitle` (`text-base font-medium`), corpo `CardContent` |
| Grade de cartões | `grid gap-4 sm:grid-cols-2 xl:grid-cols-3` |
| Formulário | `grid gap-4 md:grid-cols-2`; cada campo `grid gap-1.5` com `Label` + controle |
| Rótulo envolvendo controle (`<label>Texto<input/></label>`) | manter a estrutura (os testes usam `getByLabelText`); aplicar `className="grid gap-1.5 text-sm font-medium"` no `<label>` |
| Lista de metadados | `<dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">`, `dt` em `text-muted-foreground` |
| Estado vazio | componente `Empty` (Tarefa 3) |
| Erro | componente `Notice` (Tarefa 3), mantém `role="alert"` |
| Carregando | componente `Loading` (Tarefa 3), mantém `role="status"` |
| Ação primária | `Button` (variante padrão, pílula preta) |
| Ação secundária | `Button variant="outline"` |
| Ação textual | `Button variant="ghost"` ou `variant="link"` |
| Estado de projeto | `StatusBadge` (Tarefa 4) |
| `<details>` | `className="rounded-xl border bg-card"`, `<summary className="cursor-pointer px-4 py-3 text-sm font-medium">`, conteúdo em `px-4 pb-4` |
| Tabela larga | `<div className="overflow-x-auto rounded-xl border" role="region" aria-label="…" tabIndex={0}>` envolvendo `<table className="w-full text-sm">`; usar o `aria-label` já existente quando houver |

---

### Task 1: Fundação (dependências, Tailwind, tokens, alias)

**Files:**
- Modify: `packages/web/package.json`, `pnpm-lock.yaml`
- Modify: `packages/web/vite.config.ts`, `packages/web/vitest.config.ts`, `packages/web/tsconfig.json`
- Create: `packages/web/src/index.css`, `packages/web/src/lib/utils.ts`
- Modify: `packages/web/src/main.tsx`, `packages/web/index.html`, `packages/web/src/styles.css:1`

- [ ] **Step 1: Instalar dependências com versões exatas**

```bash
pnpm --filter @labrary/web add tailwindcss@4.3.5 @tailwindcss/vite@4.3.5 class-variance-authority@0.7.1 clsx@2.1.1 tailwind-merge@3.7.0 lucide-react@1.73.0 @fontsource-variable/inter@5.3.0
```

Esperado: `package.json` com versões exatas (`save-exact=true`), lockfile atualizado, sem erro de peer.

- [ ] **Step 2: Plugin e alias no Vite**

`packages/web/vite.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const workspaceRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, workspaceRoot, "");

  return {
    envDir: workspaceRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      proxy: {
        "/api": `http://localhost:${env.API_PORT ?? 3000}`,
      },
    },
  };
});
```

`packages/web/vitest.config.ts`: acrescentar `import { fileURLToPath } from "node:url";` e, no objeto de configuração, `resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },`.

`packages/web/tsconfig.json`: em `compilerOptions`, acrescentar `"baseUrl": ".", "paths": { "@/*": ["./src/*"] }`.

- [ ] **Step 3: Utilitário `cn`**

`packages/web/src/lib/utils.ts`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: Tokens e camadas**

Remover a primeira linha de `styles.css` (`@import url("https://fonts.googleapis.com/...")`).

`packages/web/src/index.css`:

```css
@layer theme, base, legacy, components, utilities;
@import "tailwindcss";
@import "@fontsource-variable/inter";
@import "./styles.css" layer(legacy);

@theme inline {
  --font-sans: "Inter Variable", -apple-system, "SF Pro Text", "PingFang SC",
    "Noto Sans SC", system-ui, sans-serif;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-subtle-foreground: var(--subtle-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-accent: var(--accent);
  --color-destructive: var(--destructive);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info: var(--info);
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;
}

:root {
  --background: #f5f5f7;
  --foreground: #1d1d1f;
  --card: #ffffff;
  --muted: #f5f5f7;
  --muted-foreground: #6e6e73;
  --subtle-foreground: #86868b;
  --border: #ebebeb;
  --input: #e3e3e6;
  --ring: #1d1d1f;
  --primary: #1d1d1f;
  --primary-foreground: #ffffff;
  --accent: #efeff1;
  --destructive: #c4372b;
  --success: #2f9e5b;
  --warning: #c98a1a;
  --info: #3a6fd8;
  color-scheme: light;
}

@layer base {
  * {
    border-color: var(--color-border);
  }
  html {
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  body {
    margin: 0;
    min-width: 320px;
    background: var(--color-background);
    color: var(--color-foreground);
    font-family: var(--font-sans);
    font-size: 15px;
  }
  :focus-visible {
    outline: 2px solid var(--color-ring);
    outline-offset: 2px;
  }
  input[type="checkbox"],
  input[type="radio"],
  progress {
    accent-color: var(--color-primary);
  }
}
```

Observação: as variáveis antigas `--muted`/`--border`/`--surface` de `styles.css` colidem com os novos nomes. Como `styles.css` está em `:root` sem camada própria de especificidade, renomear no arquivo legado `--muted`→`--legacy-muted`, `--border`→`--legacy-border`, `--surface`→`--legacy-surface`, `--purple`→`--legacy-purple`, `--pink`→`--legacy-pink` (substituição mecânica com `sed`), para que os tokens novos prevaleçam.

- [ ] **Step 5: Entrada e meta**

`packages/web/src/main.tsx`: trocar `import "./styles.css";` por `import "./index.css";`.
`packages/web/index.html`: `<meta name="theme-color" content="#f5f5f7" />`.

- [ ] **Step 6: Verificar**

Run: `pnpm --filter @labrary/web build && pnpm --filter @labrary/web test`
Esperado: build sem erros; testes e cobertura iguais ao estado anterior. Abrir `http://localhost:5173` e confirmar que a tela continua renderizando (visual misto é esperado).

- [ ] **Step 7: Commit** — `build(web): adicionar Tailwind, tokens visuais e alias @`.

---

### Task 2: Dividir `App.tsx` sem mudar o visual

**Files:**
- Create: `src/components/Brand.tsx`, `src/components/Feedback.tsx` (`Notice`, `Loading`, `Empty`), `src/labels.ts` (`roleLabels`, `statusLabels`, `materialLabels`, `roleDescriptions`)
- Create: `src/pages/Login.tsx`, `src/pages/Dashboard.tsx` (filtro e grade), `src/pages/ProjectDetail.tsx`, `src/pages/Profile.tsx`, `src/pages/Classes.tsx`, `src/pages/CreateProject.tsx`
- Create: `src/layout/AppShell.tsx` (barra lateral, cabeçalho, rodapé, visualização de perfil do admin)
- Modify: `src/App.tsx` (fica com `App`, `PrivateApp`: sessão, navegação, `logout`, `changeView`, seleção de tela)

- [ ] **Step 1:** Mover código **sem alterar** JSX nem classes. `Dashboard` continua dono de carregamento/estado e delega a renderização a `Profile`, `Classes`, `ProjectDetail` e à grade via props. `AppShell` recebe `{ user, visibleUser, path, navigate, busy, logout, viewBusy, changeView, children }`.
- [ ] **Step 2:** Run `pnpm --filter @labrary/web test` — esperado: todos verdes, cobertura ≥ 85%.
- [ ] **Step 3:** Run `pnpm --filter @labrary/web build` — esperado: sem erros de tipo (`noUnusedLocals`).
- [ ] **Step 4: Commit** — `refactor(web): dividir App em layout e páginas`.

---

### Task 3: Componentes base, login, inicialização e `AppShell`

**Files:**
- Create: `src/components/ui/button.tsx`, `input.tsx`, `textarea.tsx`, `label.tsx`, `native-select.tsx`, `card.tsx`, `badge.tsx`
- Modify: `src/components/Brand.tsx`, `src/components/Feedback.tsx`, `src/pages/Login.tsx`, `src/layout/AppShell.tsx`, `src/App.tsx` (telas de inicialização)

- [ ] **Step 1: `button.tsx`**

```tsx
import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/85",
        outline: "border bg-card hover:bg-accent",
        ghost: "hover:bg-accent",
        link: "h-auto px-0 underline-offset-4 hover:underline",
        destructive: "bg-destructive text-white hover:bg-destructive/90",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3 text-[13px]",
        lg: "h-11 px-5",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants>) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
```

Atenção: o `type` padrão vira `"button"`. Todo botão que hoje submete formulário por omissão de `type` precisa receber `type="submit"` explícito. Revisar cada `<form>` ao migrar.

- [ ] **Step 2: Controles de formulário**

`input.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm placeholder:text-subtle-foreground transition-colors focus-visible:border-foreground focus-visible:outline-none disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(fieldClass, "h-10", className)} {...props} />;
}
```

`textarea.tsx`: `<textarea className={cn(fieldClass, "min-h-20 py-2", className)} {...props} />`.
`native-select.tsx`: `<select className={cn(fieldClass, "h-10 appearance-none bg-[url(...)] bg-[right_0.75rem_center] bg-no-repeat pr-9", className)} {...props} />` com um chevron SVG em data-URI em `--color-muted-foreground`.
`label.tsx`: `<label className={cn("text-sm font-medium", className)} {...props} />`.

- [ ] **Step 3: `card.tsx` e `badge.tsx`**

`card.tsx` exporta `Card` (`rounded-xl border bg-card`), `CardHeader` (`flex flex-col gap-1 p-5 pb-0`), `CardTitle` (`<h2>` por padrão com `text-base font-medium`; aceitar prop `as` para `h3`), `CardDescription` (`text-sm text-muted-foreground`), `CardContent` (`p-5`). Cada um é `ComponentProps<"div">` com `cn`.

`badge.tsx`:

```tsx
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 4: `Brand`, `Notice`, `Loading`, `Empty`**

`Brand`: ícone `BookOpen` em quadrado `size-8 rounded-lg bg-primary text-primary-foreground` + texto `labrary` (`font-semibold tracking-tight`) e `DIGITAL` (`text-[10px] tracking-[0.2em] text-subtle-foreground`). Manter os textos atuais.
`Notice`: `<div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">`.
`Loading`: `<div role="status" className="flex items-center gap-3 py-10 text-sm text-muted-foreground">` com spinner `size-4 animate-spin rounded-full border-2 border-border border-t-foreground` e o texto atual.
`Empty`: `rounded-xl border border-dashed bg-card px-6 py-12 text-center`, ícone `Folder` em círculo `bg-muted`, título `h2` `text-base font-medium`, texto `text-sm text-muted-foreground`.

- [ ] **Step 5: Login**

Remover o painel ilustrado (`circuit-art`, órbitas, rodapé de história). Estrutura: `<main className="grid min-h-dvh place-items-center bg-background p-4">` com `Card` de `max-w-[400px] w-full p-8`. Ordem: `Brand`; eyebrow "BEM-VINDO DE VOLTA"; `h1#login-title` "Seu próximo projeto começa aqui." (antes `h2`; os testes buscam só o nome do heading, sem nível); link "Explorar acervo público" (`variant="link"`); descrição; avisos; Google como `<a className={buttonVariants({ variant: "outline", size: "lg" })}>`; formulário com `Label`/`Input`; campo de senha com botão de ícone `Eye/EyeOff` absoluto dentro do campo, mantendo `aria-label` e `aria-pressed`; submit `Button type="submit" size="lg" className="w-full"` com o mesmo texto; ajuda e nota de segurança em `text-xs text-muted-foreground`. Remover o texto decorativo "Grandes ideias. Conexões reais." e o rodapé "Projetos que conectam." (nenhum teste os procura).

- [ ] **Step 6: Inicialização** — `startup` vira `grid min-h-dvh place-items-center gap-4` com `Brand`, `Loading`/`Notice` e `Button` "Tentar novamente".

- [ ] **Step 7: `AppShell`**

Renderizar **um único** `nav[aria-label="Navegação principal"]` e **um único** botão "Sair da conta" — duplicá-los para desktop e celular quebraria `getByRole` nos testes. O mesmo `aside` muda de forma por breakpoint:

- Contêiner: `div.min-h-dvh.bg-background lg:grid lg:grid-cols-[240px_1fr]`.
- `aside`: em `lg:` coluna `sticky top-0 h-dvh flex flex-col gap-6 p-5`; abaixo de `lg`, `sticky top-0 z-10 flex flex-wrap items-center gap-3 bg-background/90 px-4 pt-3 backdrop-blur`.
  - Marca (link para `/projetos`).
  - Selo "Espaço acadêmico 2026" e rótulo "MEU ESPAÇO": `hidden lg:block`, `text-xs text-muted-foreground`.
  - `nav`: `order-last w-full flex gap-1 overflow-x-auto pb-3 lg:order-none lg:flex-col lg:overflow-visible lg:pb-0`. Itens `flex h-9 shrink-0 items-center gap-2.5 rounded-full px-3.5 text-sm text-muted-foreground hover:text-foreground`; ativo `bg-card text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)]` com `aria-current="page"`.
  - Bloco do usuário: `ml-auto flex items-center gap-2 lg:ml-0 lg:mt-auto`; avatar de iniciais (`size-8 rounded-full border bg-card text-xs`) e nome/papel visíveis só em `lg:`; `Button variant="ghost" size="sm"` "Sair da conta" sempre visível.
  - Remover o cartão decorativo "Ideias ganham vida" (nenhum teste o procura).
- Conteúdo: `div.lg:p-2` com painel `min-h-[calc(100dvh-16px)] bg-card lg:rounded-xl lg:border`; cabeçalho `flex items-center justify-between border-b px-5 py-3 text-sm md:px-10` com trilha "Meu espaço / X" e `Badge` do papel; `main#main.mx-auto.max-w-[1120px].px-5.py-8.md:px-10`; rodapé `text-xs text-subtle-foreground`.
- Link "Pular para o conteúdo": `sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-card focus:px-4 focus:py-2`.

- [ ] **Step 8:** Run `pnpm --filter @labrary/web test` — esperado: verde. Corrigir JSX até passar.
- [ ] **Step 9:** Capturas em 1440px e 390px: login, carregamento, painel vazio.
- [ ] **Step 10: Commit** — `style(web): componentes base, login e estrutura da área logada`.

---

### Task 4: Projetos, detalhe, perfil, turmas e criação

**Files:**
- Create: `src/components/StatusBadge.tsx`
- Modify: `src/pages/Dashboard.tsx`, `ProjectDetail.tsx`, `Profile.tsx`, `Classes.tsx`, `CreateProject.tsx`

- [ ] **Step 1: `StatusBadge`** — `Badge` com ponto `size-1.5 rounded-full` colorido: `PREPARACAO→bg-info`, `EM_AVALIACAO→bg-warning`, `AJUSTES→bg-destructive`, `FINALIZADO→bg-success`; texto de `statusLabels`.
- [ ] **Step 2: Painel** — cabeçalho de página com "Olá, {nome}." (o ponto final faz parte do nome acessível usado no E2E `Olá, Administrador.`; manter o texto idêntico) e botão "+ Novo projeto"; resumo em `Card` com contador grande (`text-3xl font-semibold tabular-nums`) e três estatísticas separadas por `divide-x` (empilham em `sm`); título "Seus projetos"/"Meu projeto" com contagem em `Badge`; filtros `grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]` com `Input` (ícone `Search` absoluto) e `NativeSelect`; grade de cartões sem capa decorativa: `Card` com categoria (`text-xs text-muted-foreground`) + `StatusBadge`, título `h3` com link, descrição `line-clamp-2`, pendências, rodapé com grupo e link "Abrir projeto".
- [ ] **Step 3: Detalhe** — botão "Todos os projetos" (`variant="ghost" size="sm"` com `ArrowLeft`), cabeçalho de página, `StatusBadge`, pendências, nota de acesso em `text-xs text-muted-foreground` com `Lock`; painéis filhos empilhados em `grid gap-6`.
- [ ] **Step 4: Perfil, turmas e criação** — aplicar receitas (`Card`, `dl`, grade de cartões, formulário). `CreateProject`: botão de envio com `type="submit"`.
- [ ] **Step 5:** `pnpm --filter @labrary/web test` verde; capturas de painel, detalhe, perfil e turmas (professor e aluno), 1440px e 390px.
- [ ] **Step 6: Commit** — `style(web): painel de projetos, detalhe, perfil e turmas`.

---

### Task 5: Acervo público

**Files:** Modify `src/Catalog.tsx`, `src/CatalogDemo.tsx`

- [ ] **Step 1:** Ler `Catalog.tsx` e `Catalog.test.tsx`/`e2e/catalog.spec.ts`. Layout público próprio: cabeçalho simples (marca + link "Entrar"), `main` centralizado `max-w-[1120px]`, filtros como no painel, grade de cartões (receita), detalhe com materiais em `grid gap-4 md:grid-cols-2` dentro de `Card`, vídeo `w-full rounded-lg`.
- [ ] **Step 2:** `pnpm --filter @labrary/web test` verde; capturas de lista e detalhe em 1440px e 390px.
- [ ] **Step 3: Commit** — `style(web): acervo público`.

---

### Task 6: Painéis do projeto

**Files:** Modify `src/Materials.tsx`, `src/Submission.tsx`, `src/Groups.tsx`, `src/PublicationPanel.tsx`, `src/ProjectFeedback.tsx`

- [ ] **Step 1:** Cada painel vira `Card` com `CardHeader`/`CardTitle` usando o mesmo nível de título atual. `<input type="file">` estilizado com `file:mr-3 file:rounded-full file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm`; `<progress>` com `h-1.5 w-full overflow-hidden rounded-full` e `[&::-webkit-progress-bar]:bg-muted [&::-webkit-progress-value]:bg-primary`; checkboxes nativos alinhados com `flex items-start gap-2`; `<details>` pela receita; mensagens de feedback em lista `divide-y`.
- [ ] **Step 2:** Revisar todo `<form>`: botões de envio com `type="submit"`.
- [ ] **Step 3:** `pnpm --filter @labrary/web test` verde; capturas do detalhe de projeto como aluno e professor.
- [ ] **Step 4: Commit** — `style(web): painéis de materiais, entrega, grupos, publicação e feedback`.

---

### Task 7: Avaliação e notas

**Files:** Modify `src/Evaluations.tsx`, `src/Rubrics.tsx`, `src/ProjectAssessment.tsx`, `src/Gradebook.tsx`, `src/GroupResult.tsx`

- [ ] **Step 1:** Aplicar receitas; `Gradebook` usa a receita de tabela larga (cabeçalho `bg-muted text-xs text-muted-foreground`, linhas `border-t`, números `tabular-nums text-right`). Campos `datetime-local` usam `Input`.
- [ ] **Step 2:** `pnpm --filter @labrary/web test` verde; capturas de avaliação (avaliador), rubricas e consolidação (professor) em 1440px e 390px, conferindo que a tabela rola dentro do contêiner e a página não.
- [ ] **Step 3: Commit** — `style(web): avaliação, rubricas e consolidação de notas`.

---

### Task 8: Administração, limpeza e verificação final

**Files:** Modify `src/AdminUsers.tsx`, `src/layout/AppShell.tsx` (seletor "Visualizar como"); Delete `src/styles.css`, `src/Icons.tsx`; Modify `src/index.css`

- [ ] **Step 1:** Migrar `AdminUsers` e o seletor de visualização do admin (`Card` compacto com `NativeSelect`).
- [ ] **Step 2:** `grep -rn "className=\"[a-z]" src --include=*.tsx | grep -v "\.test\."` — não deve restar classe do CSS legado. `grep -rn "Icons" src` — sem uso.
- [ ] **Step 3:** Remover `styles.css`, `Icons.tsx`, a linha `@import "./styles.css" layer(legacy);` e `legacy` da declaração `@layer`.
- [ ] **Step 4:** Na raiz: `pnpm build`, `pnpm test` (cobertura ≥ 85% nas quatro métricas da API e da web) e `pnpm test:e2e` (desktop e mobile). Todos verdes. Diferenciar falha preexistente de regressão.
- [ ] **Step 5:** Capturas finais de todas as telas em 1440px e 390px com as três contas; checar foco por teclado na navegação, formulário de login e filtros; checar ausência de rolagem horizontal da página em 390px (`document.documentElement.scrollWidth <= innerWidth`).
- [ ] **Step 6: Commit** — `style(web): administração e remoção do CSS legado`.

---

## Notas de execução (19/11/2026)

- **Ganchos de teste por classe.** Alguns testes localizam elementos por classe CSS: `.status-pill` (unitário e E2E), `.material-card`, `.submission-rounds` (E2E) e `.feedback` (unitário). Essas classes foram mantidas, sem estilo próprio, nos elementos equivalentes.
- **Tarefas 6 e 7 combinadas com a remoção do CSS legado.** Os painéis usam muitos `<button>`, `<input>`, `<label>`, `<details>` e `<progress>` sem classe, estilizados antes por seletores de elemento. Em vez de reescrever cada um, `index.css` define em `@layer base` o estilo padrão desses elementos **apenas quando não têm `class`** (`:where(button):not([class])` etc.); componentes com classe continuam controlados pelos utilitários. As classes antigas compartilhadas (`secondary`, `muted`, `create-panel`…) foram trocadas por `buttonVariants()` e pelas constantes de `components/Panel.tsx`.
- **`tailwind-merge` e URLs com espaço.** Um `bg-[url(...)]` com espaços quebrava a lista de classes e descartava `bg-card`; o chevron dos selects virou o utilitário `select-chevron` em `index.css`.
- `Textarea`, `NativeSelect` e `Label` ficaram em `components/ui/input.tsx`; `CardTitle` não foi criado (títulos usam `panelTitle`).
