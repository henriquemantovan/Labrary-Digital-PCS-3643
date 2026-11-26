# Diagramas de sequência

Base `c2dbb7f`, revisão de 25/11/2026. Diagramas de comportamento; validações de entrada e erros menores foram agrupados. As permissões são sempre decididas pela API.

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

No Google, `/api/auth/google` cria uma tentativa OAuth e redireciona ao provedor. O callback verifica state, nonce, PKCE e ID token; persiste identidade e sessão no PostgreSQL. Novos usuários são ALUNO sem vínculos automáticos. Ver [SSO](login-google.md).

## Submissão e preservação de versões

```mermaid
sequenceDiagram
    participant U as Aluno
    participant A as Rotas de submissão
    participant R as Projetos e rubricas
    participant F as Storage privado
    U->>A: GET submission-checklist
    A->>R: Ler estado, prazo, rubrica e versões
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
    A->>E: Autorizar atribuição e validar rubrica da rodada
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

## Publicação: conexão real pendente

```mermaid
sequenceDiagram
    participant U as Professor
    participant A as API de publicação
    participant P as PublicationService
    participant D as Provedores C1 e C3
    U->>A: Solicitar finalização
    A->>P: Validar turma e entrega
    alt Servidor normal da base revisada
        P-->>A: Provedores ausentes
        A-->>U: 503 PUBLICATION_INTEGRATION_UNAVAILABLE
    else Provedores injetados nos testes
        P->>D: Consultar entrega e completude
        D-->>P: Snapshots C1 e C3
        P->>P: Validar versões, avaliadores e bytes
        P-->>A: Decisão de finalização persistida
        A-->>U: Pode selecionar materiais e autorizar publicação
    end
```

Este último diagrama não declara a integração concluída. O serviço de catálogo, arquivos autorizados e retirada existe; testes usam provedores injetados. Conectar os produtores reais e validar o fluxo no servidor normal é pendência de #42/#11.
