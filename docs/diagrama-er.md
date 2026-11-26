# Dados: relações físicas e lógicas

Base `c2dbb7f`, revisão de 25/11/2026. Este documento separa as tabelas efetivamente usadas pelos adapters PostgreSQL das relações lógicas persistidas em JSON. O [schema Prisma](../packages/api/prisma/schema.prisma) e o [SQL inicial](../db/schema.sql) descrevem um modelo relacional mais amplo; a presença de uma tabela não comprova seu uso pelo servidor.

## PostgreSQL ativo no modo Google

Recortes das relações utilizadas pelos adapters em `repositories/postgres*`. Campos abaixo são uma seleção; consulte as [migrations](../packages/api/prisma/migrations) para a definição física completa.

```mermaid
erDiagram
    APP_USER ||--o{ AUTH_SESSION : autentica
    APP_USER ||--o{ USER_ROLE_AUDIT : alvo
    APP_USER ||--o{ COURSE_CLASS : ministra
    APP_USER {
        bigint id PK
        varchar email
        varchar google_subject
        user_role role
        boolean active
    }
    AUTH_SESSION {
        char token_hash PK
        bigint user_id FK
        timestamptz expires_at
    }
    USER_ROLE_AUDIT {
        bigint actor_id FK
        bigint target_id FK
    }
    COURSE_CLASS {
        bigint id PK
        bigint professor_id FK
        varchar name
        smallint academic_year
    }
```

A auditoria de papéis também referencia `APP_USER` por `actor_id`. `auth_session.view_role` representa a visualização acadêmica escolhida pelo ADMIN; não altera o papel real. `oauth_login_attempt` persiste state/nonce/PKCE e expiração antes de existir uma sessão; não é uma entidade de conteúdo acadêmico. Hashes de sessão e de state substituem os tokens em claro.

```mermaid
erDiagram
    COURSE_CLASS ||--o{ STUDENT_GROUP : organiza
    STUDENT_GROUP ||--o{ GROUP_MEMBERSHIP : registra
    APP_USER ||--o{ GROUP_MEMBERSHIP : participa
    APP_USER ||--o{ PROJECT_EVALUATOR : avalia
    APP_USER ||--o{ ACADEMIC_LINK_AUDIT : altera
    STUDENT_GROUP {
        bigint id PK
        bigint class_id FK
        varchar name
    }
    GROUP_MEMBERSHIP {
        bigint group_id FK
        bigint user_id FK
        timestamptz joined_at
        timestamptz left_at
    }
    PROJECT_EVALUATOR {
        bigint project_id PK
        bigint evaluator_id PK,FK
    }
    ACADEMIC_LINK_AUDIT {
        varchar target
        bigint target_id
        bigint changed_by FK
    }
```

`project_evaluator.project_id` é uma referência lógica ao projeto do JSON privado. A migration `20261107000000_academic_links` removeu sua FK para a tabela `project` histórica; a aplicação valida projeto e turma. A FK para o avaliador permanece. Participações encerradas e auditoria preservam o histórico. As colunas USP foram mantidas por compatibilidade; não há SSO USP ativo.

## Domínio acadêmico persistido em JSON

As relações abaixo são **lógicas, não tabelas/FKs SQL ativas**:

```mermaid
erDiagram
    PROJECT ||--o{ PROJECT_MATERIAL : recebe
    PROJECT_MATERIAL ||--|{ MATERIAL_VERSION : versiona
    PROJECT ||--o{ SUBMISSION : submete
    SUBMISSION ||--|{ SUBMITTED_MATERIAL : congela
    MATERIAL_VERSION ||--o{ SUBMITTED_MATERIAL : referencia
    PROJECT ||--o{ PROJECT_MESSAGE : conversa
    PROJECT ||--o{ PUBLICATION_DECISION : audita
```

```mermaid
erDiagram
    PROJECT ||--o{ RUBRIC_VERSION : configura
    RUBRIC_VERSION ||--|{ RUBRIC_CRITERION : define
    SUBMISSION ||--o{ EVALUATION : recebe
    EVALUATION ||--o{ CRITERION_SCORE : pontua
    RUBRIC_CRITERION ||--o{ CRITERION_SCORE : referencia
    SUBMISSION ||--o{ RESULT_RELEASE : libera
```

Uma submissão guarda também a cópia da rubrica. Rubricas/avaliações/liberações usam arquivos separados, com referências verificadas pelos serviços. A decisão de publicação guarda snapshot e autorização; a conexão dos seus pré-requisitos reais ao bootstrap ainda está pendente.

| Agregado | Armazenamento configurável |
| --- | --- |
| Projetos, metadados, mensagens, rodadas e decisões de publicação | `PROJECT_DATA_FILE` |
| Grupos e vínculos locais | `GROUP_DATA_FILE` |
| Requisitos e rubricas | `RUBRIC_DATA_FILE` |
| Avaliações | `EVALUATION_DATA_FILE` |
| Liberações | `RESULT_RELEASE_DATA_FILE` |
| Bytes de cada versão | Disco privado `UPLOAD_DIR`, referenciado por `storageKey` |

IDs e fingerprints conectam os agregados; não existe transação distribuída entre PostgreSQL e os vários JSON. Um backup apenas SQL não restaura os materiais, as avaliações nem as rodadas. Ver [backup e aceitação](instalacao-e-aceitacao.md).
