# Redesign do frontend com shadcn/ui

Registro histórico de 19/11/2026. A interface integrada usa coss ui/Base UI e Tailwind, conforme a [arquitetura atual](../../arquitetura.md). As propostas e instruções abaixo pertencem ao planejamento daquele incremento; não são o guia de execução atual.

Data: 19/11/2026 · Branch: `yuhang/frontend-redesign` (a partir de `47fc731`, HU08)

## Objetivo

Reescrever a interface de `packages/web` com uma linguagem visual clara e minimalista, inspirada em <https://iandaily.xyz>, usando componentes shadcn/ui sobre Tailwind CSS. O comportamento funcional, os textos em português, as rotas e os contratos HTTP permanecem os mesmos.

## Fora do escopo

- Qualquer alteração em `packages/api`, em `docs/api-inicial.md` ou nos contratos HTTP.
- Alterações em `src/api.ts`, `src/readApi.ts` e nos clientes `*Client.ts`, exceto ajustes de import exigidos pelo build.
- Novas funcionalidades, roteador, estado global ou mudanças de regra de permissão.
- Tema escuro nesta entrega. Os tokens ficam em variáveis CSS para que um tema escuro possa ser acrescentado depois sem retrabalho.

## Linguagem visual

Valores medidos na referência e adotados como tokens:

| Token | Valor | Uso |
| --- | --- | --- |
| `--background` | `#f5f5f7` | fundo da aplicação e da barra lateral |
| `--card` | `#ffffff` | painel principal, cartões, campos |
| `--border` | `#ebebeb` | bordas de 1px |
| `--foreground` | `#1d1d1f` | texto principal e botão primário |
| `--muted-foreground` | `#86868b` (secundário) / `#6e6e73` (terciário) | legendas, metadados |
| `--radius` | 12px cartões, 16px painéis, 999px pílulas | |

- Tipografia: Inter (via `@fontsource-variable/inter`, sem CDN), com fallback de sistema. Corpo 14–15px, títulos de página 22–28px com peso 600; demais títulos com peso 500. Hierarquia por tamanho e cor, não por excesso de negrito.
- Botões: primário em pílula preta (`#1d1d1f` com texto branco); secundário em pílula branca com borda; fantasma sem fundo. Sem gradientes.
- Navegação: item ativo como pílula branca sobre o fundo cinza da barra lateral.
- Estados de projeto: `Badge` em pílula cinza com um ponto colorido de baixa saturação (preparação, avaliação, finalizado), sem fundo saturado.
- Sombras apenas em elementos flutuantes (menus, diálogos, barra de filtros fixa no celular).
- Ícones: `lucide-react` substitui `Icons.tsx`.
- Ilustrações decorativas, brilhos e gradientes atuais são removidos.

## Arquitetura técnica

- Dependências novas no `@labrary/web` (versões exatas, respeitando `minimumReleaseAge` e `strict-peer-dependencies`): `tailwindcss`, `@tailwindcss/vite`, `tw-animate-css`, `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `@fontsource-variable/inter`.
- Alias `@/` → `src/` em `vite.config.ts`, `tsconfig.json` e configuração do Vitest; `components.json` do shadcn para gerar componentes.
- Componentes shadcn copiados para `src/components/ui/`, apenas os usados: `button`, `card`, `input`, `label`, `textarea`, `badge`, `separator`, `table`, `dialog`, `alert`, `avatar`, `native-select`, `skeleton`, `tooltip` (lista final definida durante a implementação).
- `styles.css` (2166 linhas) é substituído por um `index.css` com `@import "tailwindcss"`, os tokens acima e poucos estilos base.
- `App.tsx` (1271 linhas) é dividido em:
  - `src/layout/AppShell.tsx`: barra lateral, cabeçalho com trilha e papel, conteúdo em painel branco arredondado;
  - `src/pages/Login.tsx`, `src/pages/Dashboard.tsx`, `src/pages/CreateProject.tsx`, `src/pages/Profile.tsx` etc.;
  - `App.tsx` mantém sessão, navegação por `history` e seleção de tela.
- As telas já separadas (`Catalog`, `Materials`, `Submission`, `Groups`, `Evaluations`, `Rubrics`, `Gradebook`, `ProjectAssessment`, `ProjectFeedback`, `PublicationPanel`, `GroupResult`, `AdminUsers`) são reescritas visualmente no mesmo arquivo, mantendo props e lógica.

## Layout

- Desktop (≥ 1024px): barra lateral fixa de ~240px sobre `#f5f5f7` com marca, navegação, usuário e sair; conteúdo em painel branco com margem de 8px e raio de 16px, como na referência.
- Celular e tablet (< 1024px): cabeçalho com marca, papel e botão "Sair da conta" visível; abaixo, a navegação vira uma faixa de pílulas com rolagem horizontal própria, no estilo da barra de categorias da referência. A navegação não fica escondida atrás de um menu, porque os E2E mobile (iPhone 13) clicam diretamente em "Minhas turmas", "Administrar usuários" e "Sair da conta". O conteúdo ocupa a largura toda, sem rolagem horizontal da página. Tabelas largas (notas, rubricas) ficam em contêiner com rolagem horizontal identificada.
- Login: cartão branco centralizado sobre fundo cinza, com marca, campos e ação primária; sem painel ilustrado.
- Acervo público: grade de cartões brancos com borda fina, filtros em linha acima da grade.

## Preservação de comportamento

Os testes atuais são a rede de regressão do redesign:

- Nomes acessíveis, papéis, rótulos, textos visíveis, URLs e mensagens de erro permanecem iguais, para que os testes de `src/*.test.tsx` e `e2e/` continuem localizando os mesmos elementos.
- Selects de filtro e formulário usam `native-select` (elemento `<select>` nativo estilizado), evitando reescrever os 26 usos de `selectOptions` e mantendo compatibilidade com jsdom.
- Componentes Radix com portal (`Dialog`) só substituem elementos equivalentes; se um teste precisar mudar por diferença real de semântica, a mudança mantém a mesma intenção e força da asserção.
- Fluxos de carregamento, vazio, erro, `401` e logout continuam com as mesmas mensagens.

## Ordem de entrega

1. Fundação: dependências, Tailwind, tokens, alias, componentes base e `AppShell`; `styles.css` ainda carregado para as telas não migradas.
2. Login, navegação e painel de projetos (`App.tsx` dividido).
3. Acervo público e detalhe (`Catalog`).
4. Projeto: materiais, entrega, grupos, publicação e feedback.
5. Avaliação: rubricas, avaliações, consolidação e resultado de grupo.
6. Administração e perfil; remoção de `styles.css` e `Icons.tsx`.

Cada etapa termina com `pnpm build` e `pnpm test` verdes e um commit próprio.

## Verificação

- `pnpm build`, `pnpm test` (cobertura ≥ 85% nas quatro métricas da web e da API) e `pnpm test:e2e` (desktop e mobile Chromium) na raiz ao final.
- Capturas de tela em desktop (1440px) e celular (390px) das telas principais com as contas locais de aluno, avaliador e professor, comparadas com a referência.
- Navegação por teclado e foco visível nos componentes novos.

## Riscos

- Radix em jsdom pode exigir polyfills (`ResizeObserver`, `hasPointerCapture`) em `src/test/setup.ts`.
- A cobertura pode cair com componentes `ui/` não exercitados; manter apenas os componentes usados.
- A divisão de `App.tsx` mexe na área com mais testes (`App.test.tsx`, 788 linhas); fazer a extração sem mudar lógica antes de mudar o visual.
