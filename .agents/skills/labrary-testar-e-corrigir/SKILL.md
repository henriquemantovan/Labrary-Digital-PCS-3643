---
name: labrary-testar-e-corrigir
description: Implementar e corrigir código do Labrary Digital com testes automatizados executados pela própria IA, diagnóstico de falhas, correção e nova execução. Use em funcionalidades, bugs, refatorações e falhas de build, Vitest ou Playwright deste repositório.
---

# Implementar, testar e corrigir

Entregue a alteração com evidência de execução atual. Trabalhe a partir da raiz que contém `pnpm-workspace.yaml`; confira os scripts e configurações atuais antes de usar os comandos abaixo.

## Preparar e escolher o teste

- Leia a HU e seus critérios no `README.md`, o trecho afetado e os testes próximos. Confira `git status --short` para preservar o trabalho já existente.
- Verifique `node --version` e `pnpm --version` contra `.nvmrc` e `package.json`. Se faltarem dependências, use `pnpm install --frozen-lockfile`; preserve o lockfile. Não sobrescreva um `.env` existente. Os testes atuais não exigem PostgreSQL nem geração do Prisma.
- Execute primeiro o teste relacionado para conhecer a situação inicial. Em bugs, acrescente uma reprodução e confirme que falha pela condição esperada antes de corrigir, quando viável. Se já houver um teste que reproduz o caso, aproveite-o.
- Teste comportamentos observáveis e critérios de aceitação: sucesso, entrada inválida, limites e acesso indevido conforme a mudança. Para refatorações, testes existentes podem bastar se já cobrem o comportamento preservado.

| Alteração | Onde verificar | Comando focado, a partir da raiz |
| --- | --- | --- |
| Rota, validação ou permissão | `packages/api/src/routes/*.test.ts`, com Supertest | `pnpm --filter @labrary/api exec vitest run src/routes/projectRoutes.test.ts` |
| Sessão e autenticação | `packages/api/src/routes/authRoutes.test.ts` | `pnpm --filter @labrary/api exec vitest run src/routes/authRoutes.test.ts` |
| Serviço ou configuração | Teste próximo de `packages/api/src/services/` | `pnpm --filter @labrary/api exec vitest run src/services/configuration.test.ts` |
| Interação React | `packages/web/src/App.test.tsx`, com Testing Library | `pnpm --filter @labrary/web exec vitest run src/App.test.tsx` |
| Cliente HTTP | `packages/web/src/api.test.ts` | `pnpm --filter @labrary/web exec vitest run src/api.test.ts` |
| Fluxo no navegador | `e2e/*.spec.ts`, com Playwright e API real | `pnpm test:e2e` |

Os caminhos são exemplos existentes; selecione o teste da alteração ou crie um arquivo conforme o padrão. Testes focados sem cobertura servem ao diagnóstico, não substituem a validação final.

## Ciclo de implementação e correção

1. Implemente o menor conjunto coerente de código e testes para o comportamento solicitado.
2. Execute o teste focado e leia a saída completa, inclusive o código de saída. Aguarde o processo terminar; uma sessão iniciada não é um resultado.
3. Se falhar, identifique se a causa é implementação, expectativa incompatível com o requisito, isolamento do teste ou ambiente. Corrija a causa e repita o teste. Uma expectativa só muda quando o contrato ou critério realmente mudou.
4. Depois que o caso passar, execute `pnpm build` e `pnpm test` na raiz. Este último executa as duas suítes com cobertura, sequencialmente. Os limites são 85% em linhas, statements, funções e branches, separadamente por pacote, definidos em seus `vitest.config.ts`.
5. Execute `pnpm test:e2e` quando afetar fluxo de usuário, autenticação/sessão, navegação, integração web/API ou responsividade. Se falhar, corrija a causa e execute novamente. Se alterar código após a validação, repita os checks afetados e encerre com build e testes sobre a versão final.

Continue enquanto houver correções concretas a fazer dentro da tarefa. Não pule testes, remova asserções, reduza cobertura, aumente timeouts sem diagnóstico ou acrescente esperas arbitrárias para esconder falhas. Não repita indefinidamente o mesmo comando sem nova evidência: diante de bloqueio externo sem solução local, preserve a reprodução e relate a pendência. Falhas anteriores à alteração devem ser identificadas como tal, sem apresentá-las como validação bem-sucedida nem iniciar uma reforma fora do escopo.

## Particularidades do ambiente

- API: use `context()` de `packages/api/src/test/context.ts` para instâncias isoladas com `createApp`, repositórios e relógio injetáveis. O helper `client(id)` oferece GET/POST autenticados; amplie-o se um novo método HTTP precisar disso. Não use um servidor de desenvolvimento compartilhado para testes Supertest.
- Web: use `jsdom` e o cleanup existente em `packages/web/src/test/setup.ts`. Os testes atuais simulam `fetch` na fronteira HTTP; restaure mocks e estado entre testes.
- Playwright: se faltar Chromium, instale com `pnpm exec playwright install chromium`. Se a saída indicar bibliotecas de sistema ausentes, use `pnpm exec playwright install --with-deps chromium` quando permitido pelo ambiente; se não for possível, registre o bloqueio.
- `playwright.config.ts` inicia suas próprias APIs e interfaces com contas de demonstração. Precisa das portas 3002, 3003, 5179 e 5180 livres; não mate processos alheios para liberá-las. Desktop e mobile usam Chromium, com instâncias separadas. O mobile é emulação, não teste em iPhone físico/Safari.
- Relatórios: cobertura em `packages/api/coverage/` e `packages/web/coverage/`; traces e capturas em `test-results/`. Não versione esses artefatos. Para uma falha, consulte o caminho indicado na saída e, quando houver trace, use `pnpm exec playwright show-trace <caminho-do-trace.zip>`.
- O CI em `.github/workflows/ci.yml` executa build, cobertura e E2E. A execução local não comprova o resultado remoto. ESLint é citado no planejamento, mas não há script de lint nos manifests atuais.

## Relatar o resultado

Informe de forma curta o comportamento entregue e os testes acrescentados ou ajustados. Liste os comandos realmente executados com resultado **passou**, **falhou** ou **bloqueado**. Cite a falha e a correção quando houver. Informe contagens e métricas a partir da saída atual, sem reaproveitar números históricos de `docs/hu01.md`. Se uma verificação necessária não rodou, diga por quê e não declare a tarefa totalmente validada. Testes aprovados não substituem a revisão e o aceite humano da história.
