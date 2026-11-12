# API REST (TEC02 + HU01 + HU06 + HU07)

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
| GET | `/api/projects?status=&classId=&groupId=&pending=` | Lista e filtra projetos | `200 { data: Project[] }` |
| POST | `/api/projects` | Cria projeto | `201 { data: Project }` |
| GET | `/api/projects/:projectId` | Consulta projeto | `200 { data: Project }` |
| GET | `/api/projects/:projectId/materials` | Lista metadados de materiais | `200 { data: ProjectMaterial[] }` |
| POST | `/api/projects/:projectId/materials` | Registra metadados de material | `201 { data: ProjectMaterial }` |
| GET | `/api/projects/:projectId/messages` | Consulta feedback privado | `200 { data: ProjectMessage[] }` |
| POST | `/api/projects/:projectId/messages` | Envia feedback privado | `201` ou `200` na repetição idêntica |

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

`POST /materials` registra metadados JSON e gera uma chave `mock/...`; não recebe nem persiste bytes de arquivos. A HU01 autentica e autoriza estas rotas. Limites conforme requisito do projeto, prazos e armazenamento privado real serão adicionados com as histórias de entrega. O entrypoint da API persiste projetos, metadados e mensagens em arquivo privado desde a HU07. Sem snapshot anterior, no modo local há seed; no modo USP iniciam vazios. Identidades USP e vínculos de autorização são carregados do PostgreSQL; sessões permanecem em memória.

## Acompanhamento — HU06

`GET /projects` combina os filtros opcionais `classId`, `groupId` (inteiros positivos), `status` (estado existente) e `pending` (somente `true` ou `false`). Filtros inválidos ou desconhecidos recebem `400 VALIDATION_ERROR`. A autorização por atribuição é aplicada antes do cálculo das pendências; filtros nunca ampliam o escopo.

Lista, detalhe e criação retornam os campos de `Project`, mais `groupName` e `missingMaterials`: array dos tipos obrigatórios ausentes, na ordem `VIDEO`, `RELATORIO`, `MANUAL`. Um tipo está presente quando existe ao menos uma versão de seus metadados; `OUTRO` não substitui requisito obrigatório. `pending=true` seleciona ao menos um tipo ausente; `pending=false` seleciona nenhum. Isso não comprova upload, validade de arquivo ou submissão completa. Requisitos configuráveis e prazos dependem da HU03/HU05.

`GET /projects/:projectId/materials` permite ao avaliador atribuído consultar todas as versões registradas, inclusive em Preparação/Ajustes, sem permitir alterações. Acesso fora da atribuição recebe `404` tanto no detalhe quanto nos materiais. Revogar a atribuição bloqueia a próxima requisição. As respostas de projeto selecionam explicitamente os campos de acompanhamento; notas e comentários não fazem parte desse contrato.

Não há rota de galeria pública neste incremento. Rotas privadas continuam exigindo sessão mesmo para projetos Finalizados. A abertura do conteúdo dos arquivos depende do armazenamento privado da HU04; a projeção pública deverá ser implementada e validada na HU11/HU12. Veja [escopo e revisão da HU06](hu06.md).

## Feedback privado — HU07

As rotas de mensagens exigem sessão, escopo de leitura do projeto e, em POST, proteção CSRF. Aluno do grupo, avaliador atribuído e professor da turma podem enviar em qualquer estado. Projetos fora do escopo retornam 404; filtros e IDs não ampliam autorização.

Envio: `{ "clientMessageId": "UUID", "body": "Texto de 1 a 5000 caracteres", "materialVersionId": 1 }`. `materialVersionId` é opcional/nulo para contexto geral; quando presente, referencia o `id` de uma versão retornada por `/projects/:projectId/materials` e deve pertencer ao mesmo projeto. Esse ID da base atual de metadados não deve ser confundido com os IDs do schema PostgreSQL planejado.

`ProjectMessage` contém `id`, `projectId`, `clientMessageId`, `author: { id, fullName, role }`, `body`, `createdAt` ISO UTC e `materialVersion: { id, title, versionNumber } | null`. Autor/data/contexto são definidos pelo servidor e preservados; e-mail e dados internos não são expostos. Lista em ordem crescente de data, com ID como desempate. O corpo é texto, não HTML; clientes devem exibi-lo escapado.

Projeto + autor + `clientMessageId` identificam uma tentativa lógica: criação retorna 201; repetição com mesmo texto normalizado e contexto retorna 200 com a mensagem original; payload diferente com a mesma chave retorna `409 MESSAGE_ID_CONFLICT`. Campos adicionais, UUID inválido, texto vazio/excessivo ou ID malformado recebem 400; contexto inexistente/de outro projeto recebe `404 MATERIAL_NOT_FOUND`. Falha de armazenamento retorna 500 sem atualizar o estado em memória.

Persistência do servidor em `.data/projects-<modo>.json`, substituição atômica de snapshot, um processo escritor; `PROJECT_DATA_FILE` configura outro caminho. Não há alterações no schema PostgreSQL nem armazenamento de bytes. Sessões continuam em memória. Limites e roteiro em [docs/hu07.md](hu07.md).

## Leitura de resultados e acervo — incremento S6 de Dan

`GET /api/projects/:projectId/result` exige aluno integrante do grupo e sessão; oculta nota/rubrica/critérios enquanto não liberados. `GET /api/public/projects` e `/api/public/projects/:projectId` são anônimos, usam projeção pública por allowlist e nunca leem projetos privados como fallback. Os três endpoints retornam 503 quando o provedor correspondente não está configurado. Contratos provisórios, filtros e dependências: [Dan — semana 6](dan-semana6.md). Nesta base o entrypoint ainda não possui os produtores reais C3/C4 nem a rota de bytes públicos.
