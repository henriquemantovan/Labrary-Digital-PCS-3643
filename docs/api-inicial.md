# API REST inicial (TEC02)

Todas as rotas usam JSON. Listas e respostas individuais bem-sucedidas vêm no envelope `{ "data": ... }`; erros usam `{ "error": { "code", "message", "details?" } }`. O servidor responde `400` para validação, `404` para recurso/rota ausente, `409` para conflito de grupo e `500` para falhas inesperadas.

| Método | Rota | Uso | Sucesso |
| --- | --- | --- | --- |
| GET | `/api/health` | Estado da API | `200 { data: { status: "ok" } }` |
| GET | `/api/projects?status=&classId=` | Lista e filtra projetos | `200 { data: Project[] }` |
| POST | `/api/projects` | Cria projeto | `201 { data: Project }` |
| GET | `/api/projects/:projectId` | Consulta projeto | `200 { data: Project }` |
| GET | `/api/projects/:projectId/materials` | Lista metadados de materiais | `200 { data: ProjectMaterial[] }` |
| POST | `/api/projects/:projectId/materials` | Registra metadados de material | `201 { data: ProjectMaterial }` |

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

`POST /materials` registra metadados JSON e gera uma chave `mock/...`; não recebe nem persiste bytes de arquivos. Autenticação, autorização, limites conforme requisito do projeto e armazenamento privado real serão adicionados com as histórias de entrega. O repositório é em memória e volta ao seed ao reiniciar a API.
