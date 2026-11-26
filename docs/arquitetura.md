# Arquitetura integrada — revisão de 26/11/2026

Arquitetura executável da aplicação. O DER descreve também funcionalidades planejadas; esta página identifica os componentes conectados, as fronteiras de autorização e a persistência efetiva.

```mermaid
flowchart TD
    WEB[React: projetos, entrega, avaliação e publicação] -->|JSON ou multipart, cookie e CSRF| API[Express: sessão e escopo efetivo]
    API --> C0[Requisitos e rubricas versionados]
    API --> C1[HU05: submissão imutável]
    C0 --> C1
    C1 --> C2[HU08: avaliação por rodada e revisão]
    C2 --> C3[HU09: consolidação e liberação explícita]
    C1 --> S1[createSubmissionProvider]
    C3 --> S3[createPublicationEvaluationProvider]
    S1 --> HU11[HU11: verificar, finalizar, publicar ou retirar]
    S3 --> HU11
    HU11 --> AUD[Decisões no snapshot privado de projetos]
    HU11 --> C4[C4: lista explícita de metadados e versões autorizadas]
    VIS[Visitante: acervo React] --> C4
    C4 --> BYTES[Bytes privados: autorização em GET, HEAD e Range]
```

## Interface e implantação

`App.tsx` seleciona a página inicial pública, o acervo e a área autenticada. As telas ficam em `pages/`; `layout/AppShell.tsx` reúne a navegação. A interface usa componentes coss ui/Base UI, Lucide e tokens Tailwind de `index.css`. O cadastro USP pendente antecede a navegação privada; convites são administrados pelo ADMIN. O player privado usa sessão e Range e só carrega ao apertar Play.

Vite encaminha `/api` à API durante o desenvolvimento. Em produção, servir `packages/web/dist` com fallback de SPA e encaminhar `/api` à API na mesma origem; `NODE_ENV=production` exige `APP_ORIGIN` HTTPS. O build não publica nem inicia um servidor web de produção.

## Composição e fronteiras

`server.ts` abre os repositórios persistentes e os injeta em `createApp`. A factory mantém portas substituíveis para testes; não carrega dados de avaliação de exemplo por padrão. Com `evaluationRepository`, cria o serviço real de avaliação. Consolidação e publicação compartilham a mesma instância de `EvaluationProvider` e o mesmo repositório de liberações.

O adapter C1 consulta a última rodada persistida, inclusive quando devolvida; a HU11 recusa esse estado. O adapter C3 chama `consolidate`, reutilizando validação da rubrica, critérios e notas. Projeta apenas IDs e sinais de completude/liberação; não transporta notas ou comentários para a publicação. O fingerprint identifica uma liberação do resultado ao grupo; não constitui autorização de divulgação.

`publicationService` autentica o escopo docente, verifica a mesma rodada/rubrica e os avaliadores atuais, confere metadados e presença/tamanho dos arquivos e relê C1/C3 após as operações assíncronas. Só então grava a decisão. Uma reabertura concorrente não pode aproveitar a prontidão anterior. Depois de `FINALIZADO`, as rotas reais de avaliação e devolução recusam alterações da rodada. Ações da HU11 são serializadas por projeto dentro do processo; não há transação distribuída entre processos.

Controllers validam schemas, sessão e CSRF; serviços aplicam regras; repositórios gravam antes de atualizar o estado em memória. A View recebe permissões do backend. ADMIN em prévia usa o perfil e os vínculos efetivos; o autor das decisões HU11 é a conta real da sessão.

## Persistência efetiva

| Informação | Armazenamento e configuração |
| --- | --- |
| Projetos, materiais, versões, mensagens, rodadas C1, reaberturas e decisões HU11 | Snapshot privado `PROJECT_DATA_FILE` |
| Requisitos e rubricas históricas | `RUBRIC_DATA_FILE`, padrão `${PROJECT_DATA_FILE}.rubrics.json` |
| Avaliações e histórico de revisões C2 | `EVALUATION_DATA_FILE`, padrão `${PROJECT_DATA_FILE}.evaluations.json` |
| Decisões de liberação C3 | `RESULT_RELEASE_DATA_FILE`, padrão `${PROJECT_DATA_FILE}.results.json` |
| Conteúdo dos materiais | `STORAGE_PROVIDER=disk` usa `UPLOAD_DIR`; `r2` usa bucket privado Cloudflare R2. Bytes passam pela API |
| Contadores de operações R2 | Arquivo privado `R2_USAGE_FILE`, padrão `${PROJECT_DATA_FILE}.r2-usage.json`; preservar entre reinícios |
| Contas locais | Diretório JSON provisionado ou contas optativas de demonstração |
| Vínculos e auditoria locais | `GROUP_DATA_FILE`, padrão `${PROJECT_DATA_FILE}.groups.json` |
| Identidades, vínculos, auditoria, sessões e tentativas OAuth no modo Google | PostgreSQL; migrations anteriores preservadas |
| Cadastro acadêmico dos alunos e autorizações/histórico de convidados | PostgreSQL no modo Google; adapter em memória na factory/local |
| Oito contas de teste e seus vínculos/sessões | Mesmo PostgreSQL do desenvolvimento Google; login exige `DEV_TEST_LOGIN` habilitado |
| Sessões locais | Memória; novo login após reiniciar |

Os arquivos privados exigem um único escritor e disco persistente. O snapshot de finalização e o estado `FINALIZADO` são gravados juntos no arquivo de projetos. Avaliações e liberações estão em arquivos separados; para backup consistente, pare o escritor e conserve todo o conjunto, incluindo vínculos e bytes. Procedimento: [instalação e restauração](instalacao-e-aceitacao.md#backup-e-restauração-de-teste).

## Persistência de vídeos, imagens e documentos

Os dois adapters de `FileStorage` estão implementados. `.env.example` começa com `STORAGE_PROVIDER=disk`, que grava em `UPLOAD_DIR`; a escolha deste ambiente de desenvolvimento é `r2`, com bucket privado. `pnpm demo` e os servidores E2E forçam disco isolado, sem acessar o bucket real.

No R2, o servidor recebe o envio em temporário privado limitado, calcula assinatura/tamanho/SHA-256 e transmite o objeto pela API compatível com S3. Confirma os metadados somente depois da gravação completa e remove o temporário nas conclusões/falhas tratadas. O arquivo definitivo não depende do disco da máquina da API; projetos, rubricas, avaliações, liberações e contadores continuam em arquivos privados e exigem disco persistente.

Download e reprodução passam pela API: não há bucket público, domínio `r2.dev`, URL pré-assinada nem SDK de armazenamento no navegador. O player privado exige sessão e vínculo com o projeto; o catálogo só expõe versões selecionadas em uma publicação ativa. GET/HEAD/Range mantêm essas verificações. O vídeo é o arquivo enviado, sem transcodificação, processamento assíncrono ou qualidade adaptativa.

Trocar `STORAGE_PROVIDER` não migra os objetos anteriores. Inventarie as chaves referenciadas, copie os bytes pelas mesmas chaves e confira tamanho/SHA-256 antes da troca. Pare o escritor na transição e conserve a cópia anterior até testar upload, reprodução parcial, download privado, retirada e restauração. Backup apenas SQL não preserva os projetos e seus arquivos.

## Cloudflare R2 e controle da franquia gratuita

A opção escolhida é **Cloudflare R2 Standard**, com bucket privado. A [franquia publicada pela Cloudflare](https://developers.cloudflare.com/r2/pricing/), consultada em 26/11/2026, inclui 10 GB-mês, 1 milhão de operações A e 10 milhões B por mês; transferência de saída é gratuita. A franquia é da conta, compartilhada entre buckets, e não se aplica à classe Infrequent Access. Uso excedente é cobrado. **R2 não fornece, nessa configuração, uma garantia absoluta de custo zero: os limites abaixo pertencem à aplicação e não bloqueiam a cobrança da Cloudflare.** A aplicação não configura um bloqueio de cobrança no provedor. Confira as condições da conta e o [controle de gastos da Cloudflare](https://developers.cloudflare.com/billing/manage/spend-management/); não trate alertas como garantia de interrupção.

Para reduzir o risco, a integração limita este Labrary a **9.000.000.000 bytes no bucket**, **100.000 reservas A** e **1.000.000 reservas B por mês UTC**. Os valores têm margem abaixo da franquia. A capacidade é recalculada pela listagem paginada de todos os objetos antes de cada upload; uploads e remoções são serializados no único processo escritor. Isso inclui objetos sem metadados deixados por falhas, mas não mede outros buckets, uploads parciais criados por outras ferramentas ou alterações externas concorrentes.

Cada operação paga é reservada no disco antes da chamada remota, inclusive tentativas que falham. O SDK não repete operações automaticamente. Os contadores sobrevivem ao reinício e só são renovados no mês UTC seguinte; HEAD e verificações que não leem bytes podem reservar mais que o uso real. Uploads acima da capacidade recebem `507 STORAGE_CAPACITY_LIMIT`; esgotamento das operações recebe `503 STORAGE_OPERATION_LIMIT`. Falha remota recebe `503 STORAGE_UNAVAILABLE`. O acervo continua sujeito a esses limites, mesmo para visitantes.

O arquivo de uso ausente ou corrompido impede iniciar o modo R2. Não apague, recrie ou restaure uma cópia antiga desse arquivo para liberar cota: isso não reinicia o uso faturado pela Cloudflare. Não compartilhe bucket, credenciais ou franquia com outros sistemas. Não habilite acesso público, regras de migração para Infrequent Access, outros escritores ou serviços pagos; uso externo não é contabilizado pela aplicação. Se custo zero precisar de garantia contratual mesmo diante desses fatores, mantenha `STORAGE_PROVIDER=disk` até escolher um serviço com bloqueio de cobrança no provedor.

### Configurar uma conta e bucket novos

1. No painel **R2 Object Storage**, crie um bucket, por exemplo `labrary-materiais`, na classe **Standard**, sem jurisdição especial. Mantenha **Public Development URL (`r2.dev`) desabilitada** e não conecte domínio público. Os [buckets são privados por padrão](https://developers.cloudflare.com/r2/buckets/public-buckets/).
2. Em **Manage R2 API Tokens**, gere credenciais **Object Read & Write**, restritas apenas a esse bucket. Guarde **Access Key ID** e **Secret Access Key** no `.env` privado da API; não use variáveis `VITE_`, não envie pelo chat e não versione. O [guia de autenticação R2](https://developers.cloudflare.com/r2/api/tokens/) mostra onde obter esses valores e o Account ID.
3. Preencha a configuração abaixo. O endpoint S3 é derivado do Account ID; não é necessário contratar AWS ou criar um bucket público.

```dotenv
STORAGE_PROVIDER=r2
R2_ACCOUNT_ID=identificador_de_32_caracteres_hexadecimais
R2_BUCKET=labrary-materiais
R2_ACCESS_KEY_ID=preencher_no_ambiente_privado
R2_SECRET_ACCESS_KEY=preencher_no_ambiente_privado
# Opcional: caminho privado persistente; padrão junto do PROJECT_DATA_FILE.
# R2_USAGE_FILE=/caminho/privado/r2-usage.json
```

4. **Somente na primeira configuração de uma conta sem uso anterior no mês**, com a API parada, execute `pnpm storage:init`. O comando cria o controle local sem fazer chamadas à Cloudflare e recusa sobrescrever arquivo existente. Se a conta já teve uso, primeiro é necessário conciliar os contadores com o painel; não inicialize valores zerados como se a franquia estivesse intacta.
5. Antes de mudar uma instalação com arquivos antigos, copie-os preservando as chaves e verifique SHA-256 conforme o plano de migração acima. A troca de variável não copia `.uploads` nem altera referências dos materiais existentes. Não apague a cópia antiga antes do aceite e teste de restauração.
6. Inicie `pnpm dev` e valide upload, download privado, reprodução e retirada. Confira o painel de uso e mantenha os snapshots, o arquivo de uso e o PostgreSQL nos backups. `pnpm demo` e o E2E do entrypoint forçam disco e não usam o bucket real.

No modo R2, cada envio usa um arquivo temporário privado limitado ao tamanho da regra (e ao teto de 5 GB do upload simples) para calcular assinatura, tamanho e SHA-256 antes de transmitir. O temporário é removido no sucesso e nas falhas tratadas; a máquina da API ainda precisa de espaço temporário. Não há upload multipart remoto nem conversão de vídeo. Os metadados só confirmam a versão depois do envio completo. Leituras usam HEAD para o tamanho e GET sob demanda, com `If-Match` e Range; verificações de existência não baixam o vídeo inteiro.

Os testes do adapter exercitam bytes reais pelo SDK S3 contra um servidor HTTP local, além de cotas, reinício do contador, concorrência, isolamento e retirada pública. A [revisão de 26/11](revisao-final.md#demonstração-completa--26112026) também registra uploads, downloads e reprodução com o R2 real deste ambiente. Esses testes não auditam cobrança nem garantem disponibilidade futura do provedor.

## Contas fictícias de desenvolvimento

`DEV_TEST_LOGIN` habilita oito endereços explícitos `@labrary.test`, com senha scrypt e sem `google_subject`, ao lado do Google real. A inicialização exige Google configurado, `NODE_ENV=development` e origem `localhost`/`127.0.0.1`; a API escuta só em loopback. Em produção a opção é recusada. Não é uma liberação de senha para todo o domínio ou para contas Google legadas.

Os usuários, hashes, vínculos e sessões desse modo ficam no mesmo PostgreSQL configurado; materiais seguem `STORAGE_PROVIDER`. A conta `cadastro@labrary.test` permite demonstrar o cadastro e o bloqueio inicial, com indicação de dados fictícios. `convidado@labrary.test` exige convite vigente, inclusive nas requisições de uma sessão já aberta. Desligar a opção impede usar todas as contas reservadas, sem apagar histórico. ADMIN fictício não evita a proteção do último ADMIN real.

`pnpm contas:teste` provisiona identidades ausentes, sem sobrescrever as existentes. `pnpm demonstracao:completa`, com a API ativa, usa rotas normais para criar cenários ausentes; não injeta contratos nem muda projetos já existentes de estado. Esses comandos são auxiliares de desenvolvimento, não migrations. A [matriz do manual](manual-de-uso.md#demonstração-completa-com-postgresql-e-r2) distingue o que é criado do que já existia neste ambiente.

## Exposição pública

A listagem e o detalhe retornam somente uma decisão `PUBLICADO` ativa de um projeto `FINALIZADO`. O DTO C4 é construído campo a campo; a referência de consentimento permanece no histórico privado. O catálogo não recebe notas, mensagens, integrantes, rubrica, checksums ou chaves de armazenamento.

Cada abertura de bytes verifica a seleção autorizada e a publicação ativa, novamente após acessar o disco. A retirada revoga listagem, detalhe, GET, HEAD e novas requisições Range sem apagar os dados privados. Respostas usam `no-store`; bytes já recebidos e streams já iniciados não podem ser recolhidos. Veja [C4](contratos/c4-publicacao.md) e [limitações](limitacoes.md).

## Verificação e revisão

[publicationIntegration.test.ts](../packages/api/src/routes/publicationIntegration.test.ts) exercita C1/C2/C3/C4, reinício dos repositórios, isolamento, nova rodada e concorrência com arquivos reais. [publication-flow.spec.ts](../e2e/publication-flow.spec.ts) usa o entrypoint normal em desktop e celular emulado, sem provedores de submissão/avaliação simulados. Testes isolados com doubles continuam úteis, mas suas evidências ficam identificadas separadamente. Os comandos de verificação estão na [validação da entrega](../README.md#6-testes-ci-e-evidências); a aprovação dos fluxos depende da revisão da equipe.
