# Desenvolvimento com IA

As instruções da equipe ficam versionadas neste repositório. O [AGENTS.md](../AGENTS.md) define o fluxo comum: a IA deve implementar, escrever ou ajustar os testes pertinentes, executá-los, corrigir falhas e informar os resultados. As skills detalham como fazer isso na stack do Labrary Digital.

## Skills disponíveis

| Skill | Quando usar |
| --- | --- |
| [labrary-testar-e-corrigir](../.agents/skills/labrary-testar-e-corrigir/SKILL.md) | Funcionalidades, bugs, refatorações ou diagnóstico de testes/build |
| [labrary-api-rest](../.agents/skills/labrary-api-rest/SKILL.md) | Rotas Express, validação, autorização, regras e contratos REST |
| [labrary-interface-react](../.agents/skills/labrary-interface-react/SKILL.md) | Telas React, formulários, cliente HTTP, acessibilidade e responsividade |

## Usar no trabalho da equipe

Abra o checkout do projeto no agente de programação. As skills ficam em `.agents/skills/`, dentro do próprio repositório, para que cada integrante receba os mesmos arquivos ao atualizar sua cópia. No Codex com suporte a skills de repositório, elas podem ser selecionadas pelo nome ou sugeridas automaticamente conforme a tarefa; se o checkout já estava aberto antes da criação dos arquivos, abra uma nova sessão para atualizar a descoberta.

Exemplos de pedidos:

```text
Use $labrary-testar-e-corrigir para corrigir este bug: [descreva o problema].
Reproduza com um teste, corrija, execute os testes e informe os resultados.
```

```text
Use $labrary-api-rest para implementar [critério da HU02].
Inclua testes de sucesso, validação e acesso por outro grupo/turma.
Execute os testes e corrija as falhas antes de entregar.
```

```text
Use $labrary-interface-react para implementar [fluxo da história].
Verifique a interação, os estados de erro e o comportamento em celular.
Execute os testes pertinentes e informe os resultados.
```

Se outro assistente não descobrir skills automaticamente, peça explicitamente que leia `AGENTS.md` e o `SKILL.md` correspondente antes de trabalhar. Ele precisa ter acesso ao terminal e permissão para executar os comandos locais para realizar o ciclo completo.

## O que a análise do repositório encontrou

- API Express/TypeScript e interface React/Vite organizadas em workspaces pnpm. As versões de referência estão em `.nvmrc` e nos manifests.
- API com Supertest e Vitest; web com Testing Library, jsdom e Vitest. Cada pacote exige cobertura de pelo menos 85% em linhas, statements, funções e branches.
- Playwright usa API real e executa os fluxos em desktop e emulação mobile com Chromium. O CI executa build, cobertura e E2E.
- Projetos, metadados e sessões ainda estão em memória. O modelo Prisma e o SQL não significam que PostgreSQL esteja conectado. O endpoint de materiais registra metadados, sem upload de bytes.
- O README mistura definição do produto, histórias futuras e estado da implementação. Para os endpoints atuais, consulte [o contrato da API](api-inicial.md); para sessão e permissões, consulte [HU01](hu01.md).

## Comandos e resultado esperado

Na raiz, use o Node de `.nvmrc` e o pnpm de `package.json`. Instale as dependências com `pnpm install --frozen-lockfile` quando necessário.

```sh
pnpm build
pnpm test
pnpm exec playwright install chromium
pnpm test:e2e
```

O comando de instalação do Chromium só é necessário quando o navegador ainda não estiver disponível. Se faltarem bibliotecas de sistema, consulte o erro do Playwright e use `pnpm exec playwright install --with-deps chromium` em ambiente que permita instalá-las.

Na entrega de código, espere um relato curto: o que mudou, quais testes foram criados ou ajustados, quais comandos a IA executou, se passaram e quais problemas ela corrigiu. Uma execução bloqueada deve aparecer como bloqueada, com o motivo; números históricos não comprovam a alteração atual. A instrução é continuar corrigindo enquanto houver solução local dentro do pedido.

Esses arquivos orientam o agente; a execução depende dos recursos e permissões do ambiente. O CI continua sendo a verificação automatizada compartilhada pela equipe, e o aceite da história continua dependendo da revisão humana.
