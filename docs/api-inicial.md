# API REST (TEC02 + HU01)

Todas as rotas usam JSON, exceto o envio de arquivos de materiais (`multipart/form-data`). Listas e respostas individuais bem-sucedidas vêm no envelope `{ "data": ... }`; erros usam `{ "error": { "code", "message", "details?" } }`. O servidor responde `401` para ausência de sessão, `403` para operação não permitida/origem inválida, `429` para excesso de tentativas de login, `400` para validação, `404` para recurso/rota ausente, `409` para conflito de grupo e `500` para falhas inesperadas.

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
| GET | `/api/projects/:projectId/materials` | Lista materiais com versão atual e histórico | `200 { data: ProjectMaterial[] }` |
| GET | `/api/projects/:projectId/material-rules` | Formatos, tamanhos, prazo e se o usuário pode enviar | `200 { data: MaterialRules }` |
| POST | `/api/projects/:projectId/materials` | Registra material novo (versão 1) | `201 { data: ProjectMaterial }` |
| POST | `/api/projects/:projectId/materials/:materialId/versions` | Substitui material criando nova versão | `201 { data: ProjectMaterial }` |

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

`ProjectMaterial` contém `id`, `projectId`, `kind`, `title`, `createdBy`, `createdAt`, `currentVersion` e `versions` (da mais recente para a mais antiga). Cada versão traz `versionNumber`, `originalFilename`, `mimeType`, `sizeBytes`, `checksumSha256`, `uploadedBy { id, fullName }` e `uploadedAt`; a chave interna de armazenamento não é exposta. Criar um material com o mesmo tipo e título (sem diferenciar maiúsculas) responde `409 MATERIAL_ALREADY_EXISTS`: a substituição usa a rota de versões, que nunca apaga versões anteriores. Material inexistente ou de outro projeto responde `404 MATERIAL_NOT_FOUND`.

`MaterialRules` contém `dueAt`, `lock` (`null`, `PROJECT_LOCKED` ou `DEADLINE_PASSED`), `canUpload` e `rules` (por tipo: `kind`, `defaultTitle`, `required`, `formats[{ label, mimeType, extensions }]`, `maxSizeBytes`). Enquanto a HU03 não existe, as regras padrão são: vídeo MP4/WebM até 500 MB; relatório e manual PDF até 20 MB; outros PDF/ZIP/PNG/JPEG até 50 MB. A entrega está aberta em Preparação antes de `dueAt` e em Ajustes (reabertura pelo professor, mesmo após o prazo). Envios recusados respondem `400 EMPTY_FILE`, `413 FILE_TOO_LARGE`, `415 UNSUPPORTED_FORMAT` (tipo ou extensão fora da regra) ou `409 DEADLINE_PASSED`.

**Envio de arquivos.** `POST …/materials` e `POST …/materials/:materialId/versions` recebem `multipart/form-data` com **um** arquivo no campo `file`. Na criação, o campo `kind` deve vir **antes** do arquivo (define o limite aplicado durante o envio); `title` é opcional (padrão: título sugerido do tipo). A substituição não aceita outros campos (`400 UNEXPECTED_FIELD`). O servidor:

- recusa antes de ler o corpo se o `Content-Length` já excede o limite do tipo (`413`);
- grava em streaming numa pasta privada (`UPLOAD_DIR`), interrompendo ao passar do limite (`413 FILE_TOO_LARGE`);
- identifica o formato pelos bytes iniciais (PDF, MP4, WebM, ZIP, PNG, JPEG), ignorando o `Content-Type` do navegador; formato ou extensão fora da regra → `415 UNSUPPORTED_FORMAT`; arquivo vazio → `400 EMPTY_FILE`;
- registra tamanho real e SHA-256 da versão;
- apaga o arquivo recebido em qualquer recusa, inclusive se a entrega fechar durante o envio.

Erros de formato do envio: `400 MULTIPART_REQUIRED`, `FILE_REQUIRED`, `UNEXPECTED_FILE`, `TOO_MANY_FILES`, `TOO_MANY_FIELDS`, `FIELD_TOO_LONG` e `INVALID_MULTIPART`.

Exemplo: `curl -b cookies.txt -H 'X-CSRF-Protection: 1' -F kind=RELATORIO -F 'file=@relatorio.pdf' http://localhost:3000/api/projects/2/materials`.

O repositório de metadados é em memória e volta ao seed ao reiniciar a API; os arquivos permanecem em `UPLOAD_DIR`.
