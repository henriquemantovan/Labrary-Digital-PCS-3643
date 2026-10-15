# Diagrama de classes inicial

Modelo de domínio que acompanha o [DER](diagrama-er.md). As classes representam os objetos e serviços principais; a autorização e as regras entre objetos ficam na camada de serviço.

```mermaid
classDiagram
    class AppUser {
      +BigInt id
      +String fullName
      +String email
      +UserRole role
      +Boolean active
    }
    class CourseClass {
      +BigInt id
      +String name
      +Int academicYear
    }
    class StudentGroup {
      +BigInt id
      +String name
    }
    class GroupMembership {
      +DateTime joinedAt
      +DateTime leftAt
    }
    class Project {
      +BigInt id
      +String title
      +String description
      +String category
      +ProjectStatus status
    }
    class ProjectEvaluator {
      +DateTime assignedAt
    }
    class ProjectMaterial {
      +BigInt id
      +MaterialKind kind
      +String title
    }
    class MaterialVersion {
      +BigInt id
      +Int versionNumber
      +String storageKey
      +String mimeType
      +BigInt sizeBytes
    }
    class Submission {
      +BigInt id
      +Int roundNumber
      +SubmissionStatus status
    }
    class ProjectMessage {
      +BigInt id
      +String body
      +DateTime createdAt
    }
    class Evaluation {
      +BigInt id
      +Boolean isFinal
      +DateTime finalizedAt
    }
    class EvaluationScore {
      +Decimal score
      +String comment
    }
    class RubricVersion {
      +BigInt id
      +Int versionNumber
      +String title
    }
    class RubricCriterion {
      +BigInt id
      +Decimal weight
      +Decimal minScore
      +Decimal maxScore
    }
    class ProjectPublication {
      +BigInt id
      +PublicationStatus status
      +DateTime publishedAt
    }
    AppUser "1" --> "0..*" CourseClass : ministra
    CourseClass "1" --> "0..*" StudentGroup : organiza
    AppUser "1" --> "0..*" GroupMembership : participa
    StudentGroup "1" --> "0..*" GroupMembership : registra
    StudentGroup "1" --> "0..1" Project : desenvolve
    Project "1" --> "0..*" ProjectEvaluator : atribui
    AppUser "1" --> "0..*" ProjectEvaluator : avalia
    Project "1" --> "0..*" ProjectMaterial : recebe
    ProjectMaterial "1" --> "1..*" MaterialVersion : versiona
    AppUser "1" --> "0..*" MaterialVersion : envia
    Project "1" --> "0..*" Submission : recebe
    Project "1" --> "0..*" ProjectMessage : conversa
    AppUser "1" --> "0..*" ProjectMessage : escreve
    Submission "1" --> "0..*" Evaluation : recebe
    Evaluation "1" --> "0..*" EvaluationScore : detalha
    RubricVersion "1" --> "1..*" RubricCriterion : define
    RubricVersion "1" --> "0..*" Evaluation : referencia
    Project "1" --> "0..*" ProjectPublication : publica
```

O escopo da TEC02 inicia a View React, os controllers REST e o schema Prisma. A implementação inicial das rotas usa dados em memória; a integração persistente com PostgreSQL permanece para a etapa de persistência.
