---
name: labrary-interface-react
description: Implementar telas, formulários, navegação e integração HTTP em React, TypeScript e CSS no Labrary Digital. Use para mudanças em packages/web, acessibilidade, responsividade e fluxos de usuário.
---

# Desenvolver a interface do Labrary

Consulte a HU no `README.md`, os contratos em `docs/api-inicial.md` e os componentes atuais antes de alterar a tela. `docs/prototipos/` e `docs/prototipos/mobile/` contêm referências estáticas de histórias que podem ainda não estar implementadas. Preserve a linguagem visual atual em `packages/web/src/styles.css`, os ícones em `Icons.tsx` e os textos em português.

## Implementar dentro da estrutura existente

- `packages/web/src/App.tsx` concentra sessão, navegação e telas atuais; `src/api.ts` contém tipos, `ApiError` e o cliente `api<T>()`. Reaproveite esses pontos e extraia componentes quando a mudança justificar; não acrescente roteador, biblioteca de UI ou estado global sem necessidade da tarefa.
- O cliente recebe caminhos sem o prefixo `/api`, inclui cookies da mesma origem e o cabeçalho de proteção CSRF, desempacota `data` e trata `204`. Adapte esse cliente explicitamente caso a tarefa passe a enviar arquivos; o comportamento atual usa JSON.
- Trate carregamento, lista vazia, sucesso, erro recuperável e envio em andamento conforme o fluxo. Preserve retorno ao login em `401`, restauração de sessão e feedback real de logout; falha de revogação não significa que o usuário saiu.
- Não armazene sessão em localStorage nem decida autorização só escondendo controles. O papel exibido vem do servidor e a API precisa negar requisições fora do escopo.
- Use elementos semânticos, campos com rótulos, controles acessíveis por teclado e mensagens de erro identificáveis. Ajuste CSS para desktop e celular sem rolagem horizontal acidental; tabelas largas precisam de apresentação adequada ou rolagem identificada.
- Se o endpoint necessário ainda não existe, implemente o contrato no backend quando fizer parte do pedido; se for apenas protótipo, deixe essa condição explícita. Não apresente dados simulados como funcionalidade integrada.

## Verificar o comportamento entregue

Acrescente ou ajuste testes de interação em `packages/web/src/*.test.tsx` com Testing Library e `userEvent`, usando nomes acessíveis para localizar controles. O setup existente executa cleanup; restaure mocks de `fetch` e o histórico alterado. Teste a saída percebida pelo usuário, inclusive erros e sessão expirada quando pertinentes; não dependa de classes CSS ou estado interno para provar o fluxo.

Mudanças no cliente HTTP também precisam de casos em `src/api.test.ts`. Para fluxos de navegação, sessão, integração e responsividade, amplie os cenários em `e2e/` com Playwright usando API real e seletores por papel/rótulo. A configuração cobre desktop e emulação mobile em Chromium, com servidores próprios. Evite sleeps fixos; espere o estado visível esperado. Use capturas quando a alteração visual precisar de inspeção, além de verificar o comportamento automatizado.

Siga [labrary-testar-e-corrigir](../labrary-testar-e-corrigir/SKILL.md): execute os testes, corrija falhas e termine com `pnpm build`, `pnpm test` e os E2E pertinentes. Informe quais fluxos e viewports foram realmente verificados.
