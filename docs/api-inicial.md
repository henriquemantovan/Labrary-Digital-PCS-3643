# API REST (TEC02 + HU01)

Rotas REST usam JSON; início e retorno de OAuth fazem redirecionamentos HTTP. Listas e respostas individuais bem-sucedidas vêm no envelope `{ "data": ... }`; erros usam `{ "error": { "code", "message", "details?" } }`. O servidor responde `401` para ausência de sessão, `403` para operação não permitida/origem inválida, `429` para excesso de tentativas de login, `400` para validação, `404` para recurso/rota ausente, `409` para conflito de grupo e `500` para falhas inesperadas.

| Método | Rota | Uso | Sucesso |
| --- | --- | --- | --- |
| GET | `/api/auth/providers` | Opções disponíveis `{ usp, local }` | `200` |
| GET | `/api/auth/usp` | Inicia OAuth 1.0 na USP | `302` |
| GET | `/api/auth/usp/callback` | Valida tentativa e cria sessão | `302` para `/projetos` ou `/login?authError=usp` |
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

`PublicUser` contém `id`, `fullName`, `email`, `role`; contas USP incluem `uspNumber` e `uspAffiliations` (tipo/nome do vínculo, função e unidade). Segredos OAuth não são retornados. Em modo USP, o login local responde `403 LOCAL_LOGIN_DISABLED`. Veja [configuração USP e migrations](senha-unica-usp.md). Credenciais inválidas/inativas retornam `401 INVALID_CREDENTIALS`, sempre com `E-mail ou senha inválidos.`. Cada POST exige o cabeçalho `X-CSRF-Protection: 1`; `Origin`, se informado, deve ser igual a `APP_ORIGIN`. Não há CORS. Use a mesma origem para frontend e `/api`.

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

`POST /materials` registra metadados JSON e gera uma chave `mock/...`; não recebe nem persiste bytes de arquivos. A HU01 autentica e autoriza estas rotas. Limites conforme requisito do projeto, prazos e armazenamento privado real serão adicionados com as histórias de entrega. Projetos e metadados permanecem em memória. No modo local há seed; no modo USP iniciam vazios. Identidades USP e vínculos de autorização são carregados do PostgreSQL; sessões permanecem em memória.
