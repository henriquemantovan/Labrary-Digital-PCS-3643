# Arquitetura

O sistema é um monorepo pnpm com interface React/Vite e API Express/TypeScript. A interface chama `/api` na mesma origem; controllers validam requisições, serviços aplicam regras e repositórios acessam os dados.

## Componentes MVC — modelo C4

```mermaid
C4Component
    title Componentes do Labrary Digital
    Person(usuario, "Usuário", "Aluno, avaliador, professor, administrador ou visitante")
    Container(web, "Interface", "React e Vite", "Telas, formulários e reprodução de materiais")
    Container_Boundary(api, "API Express") {
        Component(controller, "Controllers e rotas", "TypeScript", "Sessão, validação e respostas REST")
        Component(model, "Serviços de domínio", "TypeScript", "Entrega, avaliação, resultado e publicação")
        Component(repository, "Repositórios", "TypeScript", "Persistência de identidades e domínio acadêmico")
        Component(storage, "Armazenamento de arquivos", "FileStorage", "Uploads e leitura autorizada")
    }
    ContainerDb(postgres, "PostgreSQL", "Banco relacional", "Contas, vínculos, convites e sessões")
    ContainerDb(json, "Arquivos privados", "JSON", "Projetos, rubricas, avaliações, resultados e controle R2")
    ContainerDb(r2, "Cloudflare R2", "Bucket privado", "Vídeos, imagens e documentos")
    Rel(usuario, web, "Usa")
    Rel(web, controller, "Chama", "HTTP /api")
    Rel(controller, model, "Executa regras")
    Rel(model, repository, "Consulta e grava")
    Rel(controller, storage, "Envia e lê arquivos")
    Rel(model, storage, "Confere materiais")
    Rel(repository, postgres, "Persiste")
    Rel(repository, json, "Persiste")
    Rel(storage, json, "Reserva operações R2")
    Rel(storage, r2, "Grava e lê", "API S3")
```

## Persistência

| Informação | Armazenamento |
| --- | --- |
| Identidades, dados acadêmicos, vínculos, auditoria, convites e sessões Google | PostgreSQL |
| Projetos, versões de materiais, mensagens, submissões e publicações | `PROJECT_DATA_FILE` |
| Requisitos e rubricas | `RUBRIC_DATA_FILE` |
| Avaliações | `EVALUATION_DATA_FILE` |
| Liberações de resultado | `RESULT_RELEASE_DATA_FILE` |
| Controle de uso do R2 | `R2_USAGE_FILE` |
| Vínculos no modo local | `GROUP_DATA_FILE` |
| Arquivos enviados | Disco privado ou R2, conforme configuração |

O domínio acadêmico usa arquivos JSON privados com escrita por substituição do snapshot. É suportado **um processo escritor**; não há transação distribuída entre PostgreSQL, arquivos e R2. A factory de testes aceita repositórios em memória. O modo local usa sessões em memória, e o modo Google utiliza sessões PostgreSQL.

O schema SQL inclui tabelas para um modelo mais amplo que os adapters ativos. A existência de uma tabela não implica que o domínio já esteja sendo gravado nela. Consulte o [DER](diagrama-er.md) e o [procedimento de backup](instalacao-e-aceitacao.md#backup-e-restauração).

## Autorização e privacidade

A API usa sessão em cookie HttpOnly e verifica origem e proteção CSRF nas alterações. Papéis e vínculos são conferidos no servidor: aluno acessa os próprios grupos; avaliador, os projetos atribuídos; professor, suas turmas. O administrador em prévia usa os vínculos da própria conta.

Uma submissão conserva as versões dos materiais e da rubrica. A avaliação pertence à rodada submetida. Reabrir ou alterar a avaliação invalida a liberação anterior do resultado. Finalizar o projeto não publica os materiais; a publicação exige seleção e autorização próprias.

O catálogo expõe somente publicações ativas e os materiais selecionados. Notas, feedback, integrantes e chaves de armazenamento continuam privados. A retirada bloqueia novas consultas e leituras públicas, incluindo HEAD e Range; arquivos já recebidos pelo visitante não podem ser recolhidos.

## Armazenamento de arquivos

Com `STORAGE_PROVIDER=r2`, os bytes ficam em um bucket privado. Upload, download e reprodução passam pela API; o navegador não recebe credenciais ou chaves do bucket. O envio utiliza temporário limitado para conferir formato, tamanho e SHA-256 antes da gravação definitiva. O player suporta uma faixa Range por requisição, sem transcodificação ou qualidade adaptativa.

Com `STORAGE_PROVIDER=disk`, os materiais ficam em `UPLOAD_DIR`. A troca de provedor não migra arquivos existentes: copie os objetos pelas mesmas chaves e confira tamanho/checksum antes da mudança.

Para uma configuração nova, use bucket R2 **Standard** privado e credenciais restritas a ele. Preencha `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID` e `R2_SECRET_ACCESS_KEY` no `.env`. Não exponha acesso público nem variáveis com segredo ao frontend.

O controle local limita o bucket a 9.000.000.000 bytes e reserva até 100.000 operações A e 1.000.000 B por mês UTC. As reservas são persistidas antes das chamadas remotas. O controle deve ser conservado entre reinícios e não mede uso externo da conta. A [franquia e cobrança do R2](https://developers.cloudflare.com/r2/pricing/) pertencem ao provedor; os limites da aplicação não garantem custo zero absoluto.

## Testes e recursos de demonstração

Os testes unitários e de navegador usam dados isolados. `pnpm demo` força armazenamento em disco temporário; `pnpm dev` utiliza o `.env` fornecido. As oito contas fictícias são permitidas somente em desenvolvimento local explicitamente habilitado, com as mesmas regras de acesso do ambiente configurado.

Os JSON em `docs/contratos/` são exemplos consumidos por testes e componentes de demonstração. Eles não substituem os dados reais da aplicação. Consulte a [API REST](api-inicial.md) e os [comandos de teste](../README.md#testes).
