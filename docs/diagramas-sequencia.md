# Diagramas de sequência

Validações de entrada e erros menores foram agrupados. As permissões são sempre decididas pela API.

## Login e sessão local

```mermaid
sequenceDiagram
    participant U as Navegador
    participant A as API de autenticação
    participant R as AuthRepository
    U->>A: POST /api/auth/login (email, senha, proteção CSRF)
    A->>R: Validar credenciais e conta ativa
    alt Credenciais válidas
        R-->>A: Usuário e sessão
        A-->>U: Cookie HttpOnly e perfil público
        U->>A: GET /api/auth/me com cookie
        A->>R: Consultar sessão e permissões
        R-->>A: Perfil atual
        A-->>U: Área do perfil
    else Credenciais inválidas
        A-->>U: 401 com erro genérico
    end
```

No Google, `/api/auth/google` cria uma tentativa OAuth e redireciona ao provedor. O callback verifica state, nonce, PKCE e ID token, exige e-mail verificado `@usp.br` ou convite externo vigente e persiste identidade e sessão no PostgreSQL. Novos usuários são ALUNO sem vínculos automáticos. O aluno USP precisa concluir nome completo, NUSP e ano de ingresso antes das rotas privadas; convidados são dispensados desse cadastro. Revogar o convite encerra seu acesso. Ver [SSO](login-google.md).

## Contas fictícias no desenvolvimento Google/PostgreSQL

```mermaid
sequenceDiagram
    participant U as Navegador
    participant A as API local
    participant D as PostgreSQL
    U->>A: GET /auth/providers
    A-->>U: Google e formulário de teste se habilitado
    U->>A: POST /auth/login com senha e CSRF
    A->>D: Atualizar conta, vínculos e convite
    A->>A: Verificar endereço reservado, hash e conta ativa
    alt Convidado de teste sem convite ativo
        A-->>U: 401 com erro genérico
    else Conta de teste permitida
        A->>D: Persistir hash de sessão
        A-->>U: Cookie HttpOnly e developmentTest
        alt Conta de cadastro ainda incompleta
            A-->>U: Área acadêmica bloqueada até completar os dados
            U->>A: POST /auth/profile com dados fictícios e CSRF
            A->>D: Validar unicidade e persistir cadastro
            A-->>U: Perfil completo e acesso conforme vínculos
        else Outra conta de teste autorizada
            A-->>U: Acesso conforme papel e vínculos
        end
    end
```

A opção é validada na inicialização: Google configurado, `NODE_ENV=development`, `DEV_TEST_LOGIN=true` e origem local. O callback Google permanece independente e autentica contas reais. Revogação do convite ou desativação bloqueia o convidado; desligar a opção bloqueia todas as sessões dos endereços reservados. As contas e o histórico permanecem no banco.

## Submissão e preservação de versões

```mermaid
sequenceDiagram
    participant U as Aluno
    participant A as Rotas de submissão
    participant R as Projetos e critérios de avaliação
    participant F as Storage privado
    U->>A: GET submission-checklist
    A->>R: Ler estado, prazo, critérios de avaliação e versões
    R-->>A: Checklist e bloqueios
    A-->>U: Itens obrigatórios e canSubmit
    U->>A: POST submissions com clientSubmissionId
    A->>R: Revalidar vínculo e requisitos
    alt Entrega válida
        A->>R: Persistir snapshot C1 e EM_AVALIACAO
        R-->>A: Rodada gravada
        A-->>U: Rodada e bloqueio de novos uploads
        U->>A: GET arquivo de versão autorizada
        A->>F: Abrir bytes após autorização
        F-->>A: Bytes da versão
        A-->>U: Arquivo autorizado
    else Prazo, material ou estado inválido
        A-->>U: Conflito e motivo do bloqueio
    end
```

A submissão reutiliza bytes já enviados; não faz novo upload. Repetir o mesmo identificador de submissão não cria outra rodada. A devolução pelo professor muda o projeto para Ajustes e permite nova rodada sem apagar a anterior.

## Avaliação, consolidação e resultado

```mermaid
sequenceDiagram
    participant U as Usuário por perfil
    participant A as API
    participant E as Avaliações C2
    participant C as Consolidação C3
    U->>A: Avaliador salva rascunho ou finaliza com expectedRevision
    A->>E: Autorizar atribuição e validar critérios de avaliação da rodada
    E-->>A: C2 persistido e histórico
    A-->>U: Avaliação atualizada
    U->>A: Professor consulta notas da turma
    A->>E: getCurrentRound(projectId)
    E-->>A: Rodada e avaliações reais
    A->>C: Calcular pesos, pendências e fingerprint
    C-->>A: Resultado consolidado
    A-->>U: Tabela e CSV
    U->>A: Professor confirma liberação
    A->>C: Persistir decisão para o resultado atual
    U->>A: Aluno consulta resultado do próprio grupo
    A->>C: Verificar vínculo e liberação aplicável
    alt Resultado liberado
        C-->>A: Resultado liberado
        A-->>U: Nota, critérios e comentários autorizados
    else Sem liberação válida
        C-->>A: Sem liberação aplicável
        A-->>U: Resultado bloqueado
    end
```

## Publicação

```mermaid
sequenceDiagram
    participant U as Professor
    participant A as API de publicação
    participant P as PublicationService
    participant D as Provedores reais C1 e C3
    U->>A: Solicitar finalização
    A->>P: Validar sessão e turma
    P->>D: Consultar entrega e completude da rodada
    D-->>P: Snapshot C1 e consolidação C3
    P->>P: Verificar versões, avaliadores e bytes privados
    P->>D: Revalidar rodada após operações assíncronas
    P-->>A: Finalização e snapshot persistidos juntos
    A-->>U: Pode selecionar materiais e autorizar publicação
    U->>A: Publicar seleção com autorização do grupo
    A->>P: Persistir decisão pública e manter dados privados separados
    P-->>A: DTO C4 autorizado
    U->>A: Retirar publicação
    A-->>U: Novos GET, HEAD e Range públicos bloqueados
```

`server.ts` injeta os repositórios; `createApp` compõe C1/C3 reais. Liberação de notas ao grupo é independente da autorização pública. O E2E `publication-flow.spec.ts` usa o servidor normal; as fixtures dos testes isolados continuam identificadas separadamente.
