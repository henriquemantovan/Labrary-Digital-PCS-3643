---
name: labrary-api-rest
description: Implementar ou alterar rotas Express, contratos REST, regras de negócio e autorização da API TypeScript do Labrary Digital. Use para trabalho em packages/api e integração de seus contratos com a web.
---

# Desenvolver a API do Labrary

Leia a HU no `README.md`, o contrato atual em `docs/api-inicial.md` e as regras de acesso em `docs/hu01.md`. Os endpoints previstos no README incluem histórias futuras; confira o que está registrado em `packages/api/src/routes/` antes de assumir que existe.

## Pontos de extensão

- `packages/api/src/app.ts`: factory `createApp(options)` e tratamento central de erros. Preserve a injeção de repositórios, autenticação e relógio. `server.ts` inicializa o processo; testes usam a factory.
- `routes/`: métodos e caminhos; `controllers/`: entrada HTTP, schemas Zod e resposta; `services/`: regras compartilhadas; `repositories/`: dados; `models/`: tipos do domínio. Na API NodeNext, mantenha a extensão `.js` nos imports relativos do TypeScript.
- Respostas usam `{ data: ... }` e erros `{ error: { code, message, details? } }`. Use `ApiError` para erros esperados e o middleware central para a serialização. Preserve as diferenças entre `400`, `401`, `403`, `404`, `409` e `429` documentadas no contrato.
- Os adapters atuais de projetos, autenticação e sessões são em memória. Se a tarefa pedir persistência, conecte-a explicitamente através dos repositórios e teste o armazenamento real pertinente. Apenas editar `prisma/schema.prisma` não integra o banco. Consulte `db/schema.sql` e `docs/diagrama-er.md` para mudanças de dados. Existe também `schema.sql` na raiz, atualmente com o mesmo conteúdo; o README orienta usar `db/schema.sql`. Confira a duplicação antes de mudar o schema para não deixar versões divergentes.

## Autorização que deve acompanhar cada rota

- O usuário vem da sessão validada pelo backend, nunca de `role`, turma ou grupo enviados pelo cliente. Novas rotas privadas precisam passar por `requireAuth`; proteger `/api/projects` não protege automaticamente outro prefixo.
- Reaproveite `services/permissions.ts` e os vínculos do diretório: aluno acessa seu grupo; avaliador acessa projetos atribuídos; professor acessa sua turma. Filtros só podem reduzir o conjunto permitido.
- Projeto de outro escopo responde como inexistente (`404`), inclusive para materiais. Ação de papel indevido usa `403`. A rota de material atual só permite aluno do grupo e estados `PREPARACAO`/`AJUSTES`; os demais estados recebem `409`.
- Mantenha cookie HttpOnly `labrary_session`, sessão no servidor e `X-CSRF-Protection: 1` nas mutações. Preserve a checagem de origem e a resposta de login sem informações internas. Use `/api/auth/login`, `/api/auth/me` e `/api/auth/logout`, que são as rotas implementadas.
- Estado `FINALIZADO` continua privado; publicação exige ação explícita e material autorizado. Notas e feedback permanecem privados. Registro de metadados JSON não deve ser apresentado como upload de bytes.

## Entregar com testes

Implemente testes junto da alteração e siga [labrary-testar-e-corrigir](../labrary-testar-e-corrigir/SKILL.md) para executá-los e corrigir falhas. A referência de integração é `packages/api/src/routes/projectRoutes.test.ts`; use `context()` de `src/test/context.ts` para dados isolados. Valide a resposta e o efeito observável, com sucesso, entrada inválida e acesso negado pertinente; inclua tentativa de acesso de outro grupo/turma quando envolver dados privados. Teste autenticação pelo login real quando a própria sessão for o objeto da mudança.

Atualize `docs/api-inicial.md` se o contrato mudar e ajuste os tipos e chamadas em `packages/web/src/api.ts` quando necessário. Execute build e cobertura dos dois pacotes; execute também E2E se mudar um contrato consumido pelos fluxos do navegador. Relate o resultado real e o que ainda depende de banco/serviço externo.
