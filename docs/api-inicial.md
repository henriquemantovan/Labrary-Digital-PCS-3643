# API REST (TEC02 + HU01)

Todas as rotas usam JSON. Listas e respostas individuais bem-sucedidas vêm no envelope `{ "data": ... }`; erros usam `{ "error": { "code", "message", "details?" } }`. O servidor responde `401` para ausência de sessão, `403` para operação não permitida/origem inválida, `429` para excesso de tentativas de login, `400` para validação, `404` para recurso/rota ausente, `409` para conflito de grupo e `500` para falhas inesperadas.

| Método | Rota | Uso | Sucesso |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Autentica `{ email, password }` e emite cookie HttpOnly | `200 { data: PublicUser }` |
| GET | `/api/auth/me` | Restaura a sessão | `200 { data: PublicUser }` |
| POST | `/api/auth/logout` | Revoga a sessão e limpa o cookie (idempotente) | `204` |
| GET | `/api/scope` | Turmas/grupos permitidos, sem integrantes | `200 { data: { classes, groups } }` |
| GET | `/api/health` | Estado da API | `200 { data: { status: "ok" } }` |
| GET | `/api/projects?status=&classId=` | Lista e filtra projetos | `200 { data: Project[] }` |
| POST | `/api/projects` | Cria projeto | `201 { data: Project }` |
| GET | `/api/projects/:projectId` | Consulta projeto | `200 { data: Project }` |
| GET | `/api/projects/:projectId/materials` | Lista metadados de materiais | `200 { data: ProjectMaterial[] }` |
| POST | `/api/projects/:projectId/materials` | Registra metadados de material | `201 { data: ProjectMaterial }` |

Todas as rotas de projetos, materiais e escopo exigem sessão válida. `GET /projects` aplica o escopo antes de retornar dados; filtros não ampliam acesso. Um projeto fora do escopo responde com o mesmo `404` de um projeto inexistente. Apenas professor cria projetos para grupos da própria turma; apenas aluno do grupo registra metadados enquanto o projeto está em Preparação/Ajustes (`409 PROJECT_LOCKED` nos demais estados).

`PublicUser` contém apenas `id`, `fullName`, `email`, `role`. Credenciais inválidas/inativas retornam `401 INVALID_CREDENTIALS`, sempre com `E-mail ou senha inválidos.`. Cada POST exige o cabeçalho `X-CSRF-Protection: 1`; `Origin`, se informado, deve ser igual a `APP_ORIGIN`. Não há CORS. Use a mesma origem para frontend e `/api`.

As respostas da API incluem `Cache-Control: no-store`. Veja [HU01](hu01.md) para matriz de permissões, configurações, contas e ciclo da sessão.

Exemplo de criação de projeto:

```json
{
  "classId": 1,
  "groupId": 3,
  "title": "Contador síncrono",
  "description": "Contador módulo dez com reset síncrono.",
  "category": "Lógica digital"
}
```

Exemplo de erro:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A requisição contém dados inválidos.",
    "details": [{ "path": "title", "message": "Too small: expected string to have >=1 characters" }]
  }
}
```

`POST /materials` registra metadados JSON e gera uma chave `mock/...`; não recebe nem persiste bytes de arquivos. A HU01 autentica e autoriza estas rotas. Limites conforme requisito do projeto, prazos e armazenamento privado real serão adicionados com as histórias de entrega. O repositório é em memória e volta ao seed ao reiniciar a API.

## Incremento HU02/HU03 — gestão e configuração

Todas as rotas abaixo exigem a sessão HU01; PUT/POST exigem a mesma proteção CSRF.
A resposta de projeto agora inclui `academicYear`, derivado da turma (não é um ano
livre enviado pelo cliente). O restante do contrato de criação é preservado.

| Método | Rota | Perfil e resposta |
| --- | --- | --- |
| GET | `/api/classes/:classId/administration` | Professor da turma; `{ groups, people }` |
| POST | `/api/classes/:classId/groups` | Professor da turma; `{ name }` → `201` com grupo vazio |
| PUT | `/api/classes/:classId/groups/:groupId/members` | Professor da turma; `{ memberIds: number[] }` → grupo com histórico |
| GET | `/api/projects/:projectId/evaluators` | Professor da turma; `{ evaluatorIds, history }` |
| PUT | `/api/projects/:projectId/evaluators` | Professor da turma; `{ evaluatorIds: number[] }` → vínculos e histórico |
| GET | `/api/projects/:projectId/requirements` | Usuário com acesso ao projeto; `Requirement[]` |
| PUT | `/api/projects/:projectId/requirements` | Professor da turma; `{ requirements: Requirement[] }` |
| GET | `/api/projects/:projectId/rubrics` | Usuário com acesso ao projeto; versões em ordem de criação |
| POST | `/api/projects/:projectId/rubrics` | Professor da turma; cria versão explícita, `201` |

`administration` não expõe senhas, hashes, e-mails ou sessões. `people` contém
somente `{ id, fullName, role }` das contas ativas de aluno/avaliador provisionadas
na instância, para seleção pelo professor. Não existe cadastro de contas nem um
cadastro separado de matrícula individual na turma nesta etapa. `groups` contém
os grupos da turma, `memberIds` atuais e seu histórico. O escopo público da HU01
(`/scope`) continua sem lista de integrantes. Alunos podem manter mais de um
vínculo explícito, conforme o contrato já existente da HU01.

As listas de integrantes/avaliadores substituem o conjunto atual, aceitam `[]`
para remoção e rejeitam IDs repetidos, inexistentes, inativos ou de perfil incorreto.
Cada alteração registra `{ target, targetId, before, after, changedBy, changedAt }`.
Ator e horário vêm do servidor. A próxima requisição com uma sessão já existente
reflete a remoção/inclusão do vínculo. Nome duplicado de grupo na mesma turma
retorna `409 GROUP_EXISTS`; vínculo inválido retorna `400 INVALID_LINK`.

Um requisito tem:

```json
{
  "kind": "RELATORIO",
  "label": "Relatório",
  "required": true,
  "allowedMimeTypes": ["application/pdf"],
  "maxSizeBytes": 5000000,
  "dueAt": "2026-10-28T23:59:00Z"
}
```

A lista deve ter exatamente um VIDEO, um RELATORIO e um MANUAL, todos obrigatórios.
Formatos MIME exatos (sem curingas), tamanho inteiro positivo e prazo ISO com fuso
são definidos pelo professor. O exemplo não define os limites/prazos do curso.
Antes da configuração, GET retorna `[]`; a interface oferece os três campos
obrigatórios sem inventar limites ou datas. Ela converte o prazo local para UTC.
Este incremento configura requisitos; o endpoint antigo de metadados ainda não
aplica esses requisitos nem recebe bytes. A integração da entrega é HU04/HU05.

Uma nova rubrica recebe:

```json
{
  "baseVersion": 0,
  "title": "Avaliação do projeto",
  "criteria": [
    { "title": "Funcionamento", "description": "", "weight": 70, "minScore": 0, "maxScore": 10 },
    { "title": "Documentação", "description": "", "weight": 30, "minScore": 0, "maxScore": 10 }
  ]
}
```

`baseVersion` é o **ID** da última versão do projeto, ou `0` para a primeira.
Um editor desatualizado recebe `409 RUBRIC_VERSION_CONFLICT` e precisa recarregar.
Cada POST cria snapshot novo; não há endpoint para sobrescrever/apagar versões.
Pesos positivos têm no máximo duas casas e somam exatamente 100% (soma em
centésimos); a escala é fixada em 0–10. O servidor atribui autor, data, ID e
`versionNumber` crescente por turma, alinhado à chave de `RubricVersion` no Prisma.
Projetos diferentes da mesma turma podem ter números de versão não consecutivos.

Acesso a projeto de outro escopo segue `404 PROJECT_NOT_FOUND`; turma externa
usa `404 CLASS_NOT_FOUND`; operação docente com outro perfil usa `403`.

**Persistência:** `createMemoryPlanningRepository` mantém requisitos, versões e
históricos somente no processo. Grupos/vínculos usam o diretório de autenticação
já existente. Nada escreve de volta em `AUTH_USERS_FILE`. Reiniciar restaura os
seeds e perde essas alterações. Os modelos Prisma existentes (`GroupMembership`,
`ProjectRequirement`, `RubricVersion`, `RubricCriterion`, `ProjectRubric`,
`Evaluation.rubricVersionId`) orientam a integração futura, mas não há adapter
PostgreSQL conectado nem fluxo de avaliação implementado. Não considerar o
histórico durável ou a preservação da versão usada por avaliações já concluídos.
