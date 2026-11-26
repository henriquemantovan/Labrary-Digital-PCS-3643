# Classes e tipos do domínio implementado

O backend usa interfaces TypeScript, schemas Zod e factories; os blocos UML abaixo representam tipos e relações, não classes ORM instanciadas. IDs do domínio em execução são `number`; os tipos SQL do modelo relacional são tratados no [DER](diagrama-er.md).

## Identidade, sessão e acesso

```mermaid
classDiagram
    direction TB
    class User {
        +number id
        +string fullName
        +string email
        +Role role
        +boolean active
        +boolean googleLinked
        +boolean guest
        +string uspNumber
        +number entryYear
        +boolean academicProfileCompleted
    }
    class PublicUser {
        +Role role
        +AcademicRole viewRole
        +boolean requiresAcademicProfile
        +boolean developmentTest
    }
    class Session {
        +number userId
        +number expiresAt
        +AcademicRole viewRole
    }
    class AuthRepository {
        <<interface>>
        +boolean developmentTestLogin
        +refresh()
        +createSession(userId, now, ttl)
        +getSession(token, now)
        +deleteSession(token)
    }
    class GuestInvitation {
        +number id
        +string email
        +number invitedBy
        +string createdAt
        +string revokedAt
    }
    User "1" --> "0..*" Session : autentica
    AuthRepository --> User : diretório e vínculos
    AuthRepository --> Session : hash do token
    User --> PublicUser : projeção sem hash ou estado ativo
    User "1" --> "0..*" GuestInvitation : ADMIN autoriza
```

Papéis: ALUNO, AVALIADOR, PROFESSOR e ADMIN. `viewRole` restringe o escopo acadêmico da sessão do ADMIN aos vínculos próprios. `developmentTest` identifica a projeção das contas reservadas habilitadas no desenvolvimento; não é um campo que o cliente possa enviar para obter acesso. Convidado é uma autorização associada ao e-mail, não um papel novo. Campos opcionais/nulos seguem os tipos TypeScript; consulte o [contrato de autenticação](api-inicial.md).

## Projetos, materiais e rodadas

```mermaid
classDiagram
    direction TB
    class Project {
        +number id
        +number classId
        +number groupId
        +string title
        +string category
        +ProjectStatus status
        +string dueAt
    }
    class ProjectMaterial {
        +number id
        +number projectId
        +MaterialKind kind
        +string title
    }
    class MaterialVersion {
        +number id
        +number versionNumber
        +string storageKey
        +string mimeType
        +number sizeBytes
        +string checksumSha256
    }
    class Submission {
        +number id
        +number projectId
        +number round
        +string clientSubmissionId
        +SubmissionStatus status
        +number rubricVersionId
    }
    class SubmittedMaterial {
        +number materialId
        +number versionId
        +number versionNumber
        +string mimeType
        +string checksumSha256
    }
    Project "1" *-- "0..*" ProjectMaterial : materiais
    ProjectMaterial "1" *-- "1..*" MaterialVersion : versões
    Project "1" *-- "0..*" Submission : rodadas
    Submission "1" *-- "1..*" SubmittedMaterial : snapshot
    SubmittedMaterial --> MaterialVersion : referência por ID
```

`Submission` também contém a cópia dos critérios de avaliação usados na entrega. Não há alteração retroativa de uma rodada ao substituir um arquivo ou criar outros critérios de avaliação. Mensagens (`ProjectMessage`) têm projeto, autor e contexto opcional de versão; ficam no agregado de projetos persistido no PostgreSQL.

## Critérios de avaliação

```mermaid
classDiagram
    direction TB
    class RubricVersion {
        +number id
        +number projectId
        +number classId
        +number versionNumber
        +string title
    }
    class RubricCriterion {
        +string id
        +string title
        +number weight
        +number minScore
        +number maxScore
    }
    class EvaluationContract {
        +number projectId
        +number submissionId
        +number round
        +number rubricVersionId
        +number[] expectedEvaluatorIds
    }
    class Evaluation {
        +number evaluatorId
        +string status
        +number revision
        +string finalizedAt
    }
    class CriterionScore {
        +string criterionId
        +number score
        +string comment
    }
    RubricVersion "1" *-- "1..*" RubricCriterion : critérios
    EvaluationContract --> RubricVersion : snapshot C0
    EvaluationContract "1" *-- "0..*" Evaluation : C2
    Evaluation "1" *-- "0..*" CriterionScore : notas
    CriterionScore --> RubricCriterion : criterionId
```

Os critérios de avaliação são versionados **por projeto**, com contexto de turma. Os três requisitos obrigatórios são vídeo, relatório e manual. Pesos somam 100%; notas variam de 0 a 10. Avaliações usam `PENDENTE`, `RASCUNHO`, `FINALIZADA` ou `REABERTA`, com revisão e histórico. A reabertura exige justificativa; não há campo `isFinal` no tipo C2 atual.

## Consolidação e decisões

```mermaid
classDiagram
    direction TB
    class EvaluationProvider {
        <<interface>>
        +getCurrentRound(projectId)
    }
    class ConsolidatedResult {
        +number projectId
        +number submissionId
        +number round
        +string status
        +number grade
        +boolean allEvaluationsCompleted
        +boolean resultReleased
    }
    class ResultRelease {
        +number projectId
        +number submissionId
        +number round
        +string fingerprint
        +number releasedBy
        +string releasedAt
    }
    class PublicationProviders {
        <<interface>>
        +submissions.latest(projectId)
        +evaluations.completeness(projectId, submissionId)
    }
    class PublicationDecision {
        +number id
        +number projectId
        +number submissionId
        +number actorId
        +string action
        +string createdAt
    }
    EvaluationProvider --> ConsolidatedResult : fornece C2
    ConsolidatedResult --> ResultRelease : consulta fingerprint
    PublicationProviders --> PublicationDecision : pré-requisito da decisão
```

`ResultRelease` identifica o resultado efetivo por fingerprint; alterações na rodada/avaliação podem tornar a liberação anterior inaplicável. `PublicationDecision` é uma união: `FINALIZADO` guarda a submissão, `PUBLICADO` guarda autorização e DTO público, `RETIRADO` registra a retirada. O bootstrap fornece os repositórios persistentes; `createApp` compõe os `PublicationProviders` reais com `createSubmissionProvider` e `createPublicationEvaluationProvider`. Ver [arquitetura](arquitetura.md).
