# Diagrama entidade-relacionamento

Modelo lógico inicial do MVP do Labrary Digital. Os arquivos binários permanecem em armazenamento privado; o banco guarda metadados e chaves de armazenamento. A criação física está em [`db/schema.sql`](../db/schema.sql).

```mermaid
erDiagram
    APP_USER ||--o{ COURSE_CLASS : ministra
    COURSE_CLASS ||--o{ STUDENT_GROUP : possui
    APP_USER ||--o{ GROUP_MEMBERSHIP : integra
    STUDENT_GROUP ||--o{ GROUP_MEMBERSHIP : contem
    STUDENT_GROUP ||--o| PROJECT : desenvolve
    COURSE_CLASS ||--o{ PROJECT : organiza
    PROJECT ||--o{ PROJECT_EVALUATOR : recebe
    APP_USER ||--o{ PROJECT_EVALUATOR : avalia
    PROJECT ||--o{ PROJECT_REQUIREMENT : define
    PROJECT ||--o{ PROJECT_MATERIAL : possui
    PROJECT_REQUIREMENT o|--o{ PROJECT_MATERIAL : atende
    PROJECT_MATERIAL ||--|{ MATERIAL_VERSION : versiona
    PROJECT ||--o{ SUBMISSION : recebe
    SUBMISSION ||--o{ SUBMISSION_MATERIAL : congela
    MATERIAL_VERSION ||--o{ SUBMISSION_MATERIAL : compoe
    PROJECT ||--o{ PROJECT_MESSAGE : conversa
    APP_USER ||--o{ PROJECT_MESSAGE : escreve
    COURSE_CLASS ||--o{ RUBRIC_VERSION : define
    RUBRIC_VERSION ||--|{ RUBRIC_CRITERION : contem
    PROJECT }o--o{ RUBRIC_VERSION : usa
    SUBMISSION ||--o{ EVALUATION : avaliada
    APP_USER ||--o{ EVALUATION : realiza
    RUBRIC_VERSION ||--o{ EVALUATION : referencia
    EVALUATION ||--o{ EVALUATION_SCORE : detalha
    RUBRIC_CRITERION ||--o{ EVALUATION_SCORE : pontuado
    PROJECT ||--o{ RESULT_RELEASE : libera
    SUBMISSION ||--o{ RESULT_RELEASE : resultado
    PROJECT ||--o{ PROJECT_PUBLICATION : publica
    PROJECT_PUBLICATION ||--o{ PUBLICATION_MATERIAL : autoriza
    MATERIAL_VERSION ||--o{ PUBLICATION_MATERIAL : expoe

    APP_USER {
      bigint id PK
      string full_name
      string email UK
      string password_hash
      user_role role
    }
    COURSE_CLASS {
      bigint id PK
      string name
      smallint academic_year
      bigint professor_id FK
    }
    STUDENT_GROUP {
      bigint id PK
      bigint class_id FK
      string name
    }
    GROUP_MEMBERSHIP {
      bigint id PK
      bigint group_id FK
      bigint user_id FK
      timestamptz joined_at
      timestamptz left_at
    }
    PROJECT {
      bigint id PK
      bigint class_id FK
      bigint group_id FK
      string title
      string category
      project_status status
    }
    PROJECT_EVALUATOR {
      bigint project_id PK,FK
      bigint evaluator_id PK,FK
    }
    PROJECT_REQUIREMENT {
      bigint id PK
      bigint project_id FK
      material_kind kind
      boolean required
      bigint max_size_bytes
    }
    PROJECT_MATERIAL {
      bigint id PK
      bigint project_id FK
      bigint requirement_id FK
      material_kind kind
    }
    MATERIAL_VERSION {
      bigint id PK
      bigint material_id FK
      int version_number
      string storage_key UK
      string mime_type
      bigint size_bytes
    }
    SUBMISSION {
      bigint id PK
      bigint project_id FK
      int round_number
      submission_status status
    }
    SUBMISSION_MATERIAL {
      bigint submission_id PK,FK
      bigint material_id PK,FK
      bigint material_version_id FK
    }
    PROJECT_MESSAGE {
      bigint id PK
      bigint project_id FK
      bigint author_id FK
      bigint material_version_id FK
      text body
    }
    RUBRIC_VERSION {
      bigint id PK
      bigint class_id FK
      int version_number
      string title
    }
    RUBRIC_CRITERION {
      bigint id PK
      bigint rubric_version_id FK
      string title
      numeric weight
      numeric min_score
      numeric max_score
    }
    PROJECT_RUBRIC {
      bigint project_id PK,FK
      bigint rubric_version_id PK,FK
    }
    EVALUATION {
      bigint id PK
      bigint submission_id FK
      bigint evaluator_id FK
      bigint rubric_version_id FK
      boolean is_final
    }
    EVALUATION_SCORE {
      bigint evaluation_id PK,FK
      bigint criterion_id PK,FK
      numeric score
      text comment
    }
    RESULT_RELEASE {
      bigint id PK
      bigint project_id FK
      bigint submission_id FK
      timestamptz released_at
      timestamptz revoked_at
    }
    PROJECT_PUBLICATION {
      bigint id PK
      bigint project_id FK
      publication_status status
      bigint published_by FK
      timestamptz published_at
    }
    PUBLICATION_MATERIAL {
      bigint publication_id PK,FK
      bigint material_version_id PK,FK
    }
```

## Regras importantes

- Um projeto pertence a um único grupo e turma. A chave estrangeira composta impede que o grupo de outra turma seja associado ao projeto.
- O histórico de integrantes preserva entradas e saídas; um aluno só pode ter um vínculo ativo com grupo por vez.
- Cada envio cria uma rodada (`submission`) e fixa as versões exatas em `submission_material`, sem sobrescrever materiais anteriores.
- A rubrica e seus critérios são versionados; cada avaliação registra qual versão usou.
- Mensagens, notas, versões de materiais e resultados são privados. A publicação é explícita e associa somente versões autorizadas.
- A soma dos pesos da rubrica, a autorização por papel e as regras de transição de estado devem ser validadas pela camada de serviço/transação da aplicação.
