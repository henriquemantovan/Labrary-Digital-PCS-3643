# Dan — semana 6, tarefa #40

Incremento local de HU10/HU12 sobre `3ce0bf6`. Esta base antecede `91e8bad` citado no planejamento: contém feedback e metadados, mas não contém a entrega de upload do PR #31 nem os produtores C3/C4. Não foi substituído trabalho de outras áreas.

## Implementado

- Resultado no detalhe privado do projeto do aluno: carregamento, erro recuperável, sessão expirada, bloqueado, parcial liberado e final liberado; rubrica, pesos, notas por critério e comentários liberados. Nota nula significa pendência; zero é uma nota válida.
- API verifica sessão, papel e vínculo atual antes de consultar C3; projeto alheio/inexistente recebe o mesmo 404. Antes da liberação, nota e rubrica são nulas e critérios/comentários são omitidos.
- Acervo anônimo em `/acervo`, detalhe em `/acervo/:id`, busca por título e filtros combinados por ano, turma e categoria. Componentes acessíveis e responsivos, vídeo HTML nativo com controles e links de documentos.
- Interface de leitura injetável em `createApp({ readProviders })`. Sem produtor configurado, retorna 503; não carrega fixtures nem publica projetos privados do seed.
- Projeção pública por allowlist, somente `published=true`, `Cache-Control: no-store`. URLs aceitas apenas no formato `/api/public/materials/:versionId/content`, reservado ao produtor de bytes autorizados.

## Contratos consumidores provisórios

Tipos compartilhados em `packages/api/src/models/readModels.ts`; o cliente web importa somente tipos, sem código servidor. Confirmação dos produtores ainda é necessária.

| Rota GET | Resposta no envelope `data` |
| --- | --- |
| `/api/projects/:projectId/result` | `projectId`, `groupId`, `round`, `expected`, `received`, `pending`, `complete`, `released`, `grade`, `rubricVersionId`, `criteria` |
| `/api/public/projects?title=&year=&className=&category=` | Lista de projeções C4 publicadas; filtros combinados, título sem distinguir maiúsculas |
| `/api/public/projects/:projectId` | Projeção C4 publicada; ausente/despublicada retorna 404 |

C3: cada critério contém `title`, `weight`, `grade`, `comment`. `released` e `complete` são independentes: completude não libera nota nem autoriza publicação. Produtor deve retornar somente comentários liberáveis no resultado liberado, preservar versão da rubrica e rodada e validar os valores consolidados.

C4: `id`, `title`, `description`, `year`, `className`, `category`, `published`, `materials`. Cada material tem `versionId`, `title`, `kind` e `url`. O produtor deve oferecer somente versões autorizadas e reler o estado atual a cada consulta. Notas, feedback e chaves de armazenamento nunca são serializados.

## Integrações pendentes e aceite

- **Kauê, #41:** C3 real com consolidação e liberação persistidas; conectar `readProviders.result.get` no entrypoint. Confirmar nomes de campos e compartilhar exemplos de contrato.
- **Henrique, #37:** C4 real e endpoint de bytes autorizado; conectar `readProviders.publications.list/get`. O endpoint de bytes precisa revalidar publicação/versão a cada GET/Range, negar URL direta após despublicação e suportar vídeo com `206`, `Content-Range`, MIME correto e `416` para intervalos inválidos.
- A rota de bytes não é implementada aqui: nesta base nem upload real existe. Os testes de componentes verificam controles e URLs, mas não comprovam reprodução/Range reais. E2E local verifica a indisponibilidade segura com a API real. Publicação/despublicação com bytes e resultado real antes/depois da liberação continuam para integração/aceite da S7.
- Não foram alterados banco, snapshots ou procedimentos de migração. Nenhuma issue foi fechada, revisão presumida ou mensagem publicada no GitHub.

## Verificações

Execução local com Node 24.19.0 e pnpm 11.25.0 (ferramentas preparadas em `/tmp`, sem alteração de dependências/lockfile):

- `pnpm build`: passou.
- `pnpm test`: passou, 69 testes da API e 35 da web.
- Cobertura API: statements 99,80%, branches 97,39%, funções 100%, linhas 100%.
- Cobertura web: statements 97,98%, branches 94,11%, funções 99,15%, linhas 99,67%.
- `pnpm test:e2e`: passou, 18 cenários em Chromium desktop e emulação mobile, incluindo regressões de login/feedback e indisponibilidade segura dos novos provedores.
- `git diff --check`: passou.

Correções durante validação: mock HTTP passou a criar uma Response por chamada; asserções adaptadas aos matchers existentes; chaves React distintas para resultado/feedback; seletor E2E do alerta delimitado à seção de feedback; requisição de isolamento usa sessão do navegador. A primeira execução Supertest foi bloqueada por `listen EPERM` no sandbox; a execução autorizada fora dele passou.

Não confundir testes com doubles dos produtores com aceite integrado de HU10/HU12.
