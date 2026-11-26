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

## Implementação atual e rastreabilidade

A [arquitetura atual](arquitetura.md) descreve os adapters do servidor normal. Identidades, sessões e vínculos Google usam PostgreSQL; projetos, materiais, mensagens, submissões, rubricas, avaliações e liberações usam arquivos privados, além de bytes em `UPLOAD_DIR`. O servidor já realiza uploads reais. A integração pendente é a dos provedores reais da finalização/publicação.

O [registro de prompts](ia/README.md) reúne solicitações conhecidas e identifica o agente, a versão quando disponível, a base, o resultado e a validação. Este guia e as instruções de agente não substituem registrar os prompts efetivamente usados. Não reconstrua conversas nem invente modelos/versões; cada integrante deve fornecer seus registros anteriores.

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
