# Revisão final: situação, critérios e evidências

Estado documentado em 26/11/2026: merge local `43200ea` integra `origin/main` em `d9f7d83` e os incrementos até `95a5148`; as contas/cenários de desenvolvimento posteriores foram acrescentados nesta branch. A execução local não comprova publicação dos commits nem CI remoto. Os resultados históricos da base seguem identificados separadamente. Esta revisão não encerra issues nem presume aprovação acadêmica ou revisão humana.

## Revisão documental — 26/11/2026

README, instalação, manual, permissões, contratos, persistência, histórias, diagramas e apresentação foram conferidos com o código atual. Foram removidas descrições de submissão/publicação como integrações futuras e de armazenamento exclusivamente local. O roteiro distingue três contas locais de oito contas PostgreSQL de desenvolvimento e explicita quais projetos/arquivos são privados deste ambiente, em vez de prometer que acompanham o clone. Planos antigos permanecem identificados como históricos; critérios técnicos de HU01–HU12 não substituem revisão humana nem fecham issues.

Nesta revisão exclusivamente documental: 39 Markdown, 281 links locais, 64 âncoras, 21 blocos shell e 11 comandos pnpm conferidos; 17 diagramas Mermaid renderizados; slides verificados em 1440 e 390 px, com navegação, teclado e impressão. Dois links relativos do plano e duas âncoras antigas dos slides foram corrigidos. `git diff --check` aprovado. Código, configurações, `.env`, dependências, migrations, AGENTS e skills foram preservados por comparação de hashes. Build, cobertura, banco e E2E da aplicação não foram repetidos: os resultados das implementações anteriores estão datados nas seções seguintes.

## Demonstração completa — 26/11/2026

A demonstração ganhou dois acessos reservados, além das seis contas anteriores: `cadastro@labrary.test` para o primeiro cadastro e `convidado@labrary.test` para convite/revogação. A exceção de cadastro é restrita ao endereço específico e à opção validada de desenvolvimento. Não cria identidade Google nem afirma vínculo USP. As validações de nome, NUSP único e ingresso, o bloqueio da área acadêmica e a persistência usam os mesmos contratos da aplicação. O convidado fictício exige convite ativo no login e durante a sessão; repetir o seed não reativa um convite revogado.

`pnpm demonstracao:completa` prepara os cenários ausentes pelas rotas normais: avaliação com rascunho, ajustes, resultado liberado, finalizado privado, publicado, retirado e prazo vencido. O ADMIN tem uma turma separada com vínculos próprios para visualizar os três papéis. O projeto principal anterior fica preservado para apresentar o percurso completo. O [roteiro de demonstração](manual-de-uso.md#demonstração-completa-com-postgresql-e-r2) relaciona contas, funcionalidades e projetos. Os arquivos seguem o provedor configurado; a preparação deste ambiente usou R2.

| Verificação da implementação em 26/11/2026 | Resultado |
| --- | --- |
| `pnpm build` | API e web aprovadas |
| `pnpm test` | 330 testes API e 140 web aprovados; 470 no total |
| API: statements / branches / funções / linhas | 96,33% / 95,50% / 96,08% / 97,17% |
| Web: statements / branches / funções / linhas | 95,51% / 91,92% / 93,34% / 96,36% |
| `pnpm db:test` | Aprovado em PostgreSQL 18.6 local e descartável, banco vazio e existente: oito contas, cadastro após reinício, proteção do último ADMIN real, convite/revogação e seed sem reativação indevida |
| E2E focado das contas de desenvolvimento | Oito cenários aprovados, cadastro e convidados incluídos em desktop/mobile |
| `pnpm test:e2e` | 53 cenários aprovados e um timeout global de 60 s na avaliação desktop; o comando completo terminou com erro |
| `pnpm exec playwright test --config playwright.evaluation.config.ts --project desktop` | Repetição isolada aprovada em 37,1 s; mesmo código, limite e asserções |
| `pnpm exec playwright test --config playwright.publication.config.ts` | Dois cenários aprovados, desktop/mobile |
| `pnpm exec playwright test --config playwright.academic.config.ts` | Quatro cenários aprovados, desktop/mobile |
| `pnpm exec playwright test --config playwright.test-accounts.config.ts` | Oito cenários aprovados, desktop/mobile, na execução final |
| `pnpm demonstracao:completa` e repetição | Preparação real aprovada; repetição preservou os hashes de todos os arquivos de metadados e os papéis/estado das contas reais |
| Conferência do ambiente `.env` | Oito logins reais PostgreSQL, bloqueio do cadastro pendente, convidado autorizado, avaliação parcial, ajustes, resultado 9,30, CSV, prazo/reabertura, publicação/retirada e prévias ADMIN aprovados; vídeo público do R2 reproduzido e Range 206 confirmado |
| Navegador no ambiente real | Aluno, professor, avaliador, cadastro e convidado conferidos em desktop/mobile; capturas de cadastro e consolidação mobile inspecionadas, sem estouro horizontal da página |
| Documentação e Git | Cinco Markdown, 80 links locais, 18 âncoras e cinco blocos shell validados; `.env`, dados e capturas privados ignorados; `git diff --check` aprovado |

Os 68 cenários de navegador passaram no conjunto das execuções atuais: 46 gerais, quatro de submissão, dois de notas, dois de avaliação, dois de publicação, quatro de cadastro USP/convidados e oito das contas fictícias. O trace do timeout desktop registrou as etapas de nota/liberação/reabertura concluídas e o limite global atingido no POST da segunda versão de rubrica. A repetição isolada passou sem alterações; não se declara que o comando integral passou.

A primeira compilação identificou uma referência a `NodeJS.ProcessEnv` em um módulo alcançado pelos tipos da web; a configuração passou a receber um mapa de strings, mantendo as mesmas validações. O primeiro início do cluster descartável falhou por tentar o socket padrão ausente; foi corrigido especificando porta e diretório de socket locais. Build e testes de banco foram repetidos com sucesso. Nenhuma dependência, migration, limite de cobertura ou timeout foi alterado.

## Contas de desenvolvimento — 26/11/2026

Registro da etapa anterior, antes da ampliação para oito contas e dos cenários completos descritos acima.

Adicionadas seis contas fictícias com senha no ambiente Google/PostgreSQL/R2, habilitadas somente por `DEV_TEST_LOGIN=true`, `NODE_ENV=development` e origem local. O login comum continua no Google. O provisionamento é idempotente e não sobrescreve identidades existentes; desligar a opção impede reutilizar sessões das contas fictícias. Um administrador de teste não substitui a proteção do último administrador real. Configuração e credenciais fictícias estão no [guia de login](login-google.md#contas-fictícias-com-senha-no-desenvolvimento-googler2).

| Verificação em 26/11/2026 | Resultado |
| --- | --- |
| `pnpm build` | API e web aprovadas |
| `pnpm test` | 328 testes API e 139 web aprovados; 467 no total |
| API: statements / branches / funções / linhas | 96,32% / 95,49% / 96,07% / 97,16% |
| Web: statements / branches / funções / linhas | 95,51% / 91,97% / 93,34% / 96,36% |
| `pnpm db:test` | Aprovado em PostgreSQL 18.6 descartável: banco vazio e adoção de banco existente, seis migrations, 25 tabelas; provisionamento repetível, hashes distintos, identidades preservadas, proteção do último ADMIN real e revogação de sessões de teste |
| `pnpm test:e2e` | Na execução com servidores adicionais pausados, 46 cenários gerais, quatro de submissão e dois de notas aprovados; processo encerrado por SIGTERM antes de concluir avaliação |
| `pnpm exec playwright test --config playwright.evaluation.config.ts` | Dois cenários aprovados, desktop/mobile |
| `pnpm exec playwright test --config playwright.publication.config.ts` | Dois cenários aprovados, desktop/mobile |
| `pnpm exec playwright test --config playwright.academic.config.ts` | Quatro cenários aprovados, desktop/mobile |
| `pnpm exec playwright test --config playwright.test-accounts.config.ts` | Quatro cenários aprovados, desktop/mobile: exceção optativa, rejeição de conta comum e revogação da sessão ao desligar |
| Documentação e arquivos privados | Cinco Markdown, 75 links locais, 13 âncoras e quatro blocos shell validados; `.env` e dados privados ignorados; sem valores secretos do `.env` nos arquivos versionáveis |

Os 64 cenários de navegador passaram no conjunto dessas execuções. A primeira tentativa completa foi interrompida após timeouts inclusive em fluxos já existentes; havia servidores adicionais de desenvolvimento e menor memória disponível. Após pausá-los, a nova tentativa aprovou os primeiros 52 cenários e terminou com SIGTERM na etapa seguinte. As quatro suítes restantes passaram nos comandos individuais acima. Não se declara sucesso do comando integral; timeouts, asserções e limites de cobertura foram preservados. As duas instâncias de desenvolvimento foram restauradas após a validação.

O teste de banco usou `TEST_DATABASE_URL` local e descartável; não criou nem removeu bancos no serviço configurado no `.env`. Nenhuma migration foi alterada. Os resultados de 25/11 abaixo descrevem a integração anterior.

No ambiente real autorizado, `pnpm contas:teste` criou os seis usuários no PostgreSQL. Foram preparados dois grupos, uma turma e dois projetos: o principal ficou em preparação, com avaliador atribuído, rubrica de pesos 50/30/20, mensagens e quatro materiais em cinco versões no bucket privado R2. Downloads conferidos por SHA-256, resposta parcial `206`, bloqueio anônimo, isolamento entre grupos e permissões foram verificados. O navegador reproduziu e avançou o vídeo no R2, em desktop e mobile. Usuários reais existentes foram preservados. As contas de teste são locais à aplicação; não são identidades Google verificadas.

## Verificações da integração atual

Execução local em Ubuntu 26.04 LTS x86_64, Node 24.19.0 e pnpm 11.25.0. Mantidos o lockfile, as migrations anteriores e os limites de 85% em cada métrica.

| Comando | Resultado em 25/11/2026 |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passou com o lockfile integrado |
| `pnpm build` | API e web aprovadas |
| `pnpm test` | 316 testes API e 136 web aprovados |
| API: statements / branches / funções / linhas | 96,28% / 95,33% / 96,03% / 97,13% |
| Web: statements / branches / funções / linhas | 95,51% / 91,93% / 93,34% / 96,36% |
| `pnpm db:status` | Banco configurado com seis migrations aplicadas; consulta sem alteração de dados |
| `pnpm db:test` | Passou em PostgreSQL 18.6 descartável, para banco vazio e adoção de banco existente; cadastro USP, convites, vínculos e sessões verificados |
| `pnpm test:e2e` | Primeira execução interrompida por timeout na submissão mobile, após 46 cenários gerais aprovados; conclusão das suítes discriminada abaixo |
| `pnpm exec playwright test --config playwright.submission.config.ts` | Repetição aprovada: quatro cenários, desktop/mobile |
| `pnpm exec playwright test --config playwright.grades.config.ts --project desktop` e `--project mobile` | Um cenário aprovado em cada execução: dois no total |
| `pnpm exec playwright test --config playwright.evaluation.config.ts` | Dois cenários aprovados com C2 persistido, desktop/mobile |
| `pnpm exec playwright test --config playwright.publication.config.ts` | Dois cenários aprovados pelo servidor normal, com C1/C2/C3/C4 reais, desktop/mobile |
| `pnpm exec playwright test --config playwright.academic.config.ts` | Quatro cenários aprovados: USP, cadastro, convite e revogação em desktop/mobile; OIDC simulado, não conta Google real |
| Cópia limpa: `pnpm install --frozen-lockfile`, `pnpm build`, `pnpm demo --prepare-only` | Todos aprovados em Ubuntu 26.04 LTS x86_64, sem `.env`, sem dados privados e com dependências instaladas do zero na cópia |
| Documentação e índice Git | 39 Markdown, 236 links locais e 37 âncoras sem erros; dez blocos shell dos guias aprovados por `bash -n`; `git diff --check` aprovado |

O teste de banco criou e removeu somente seus próprios bancos em um cluster local temporário, sem usar o PostgreSQL configurado no `.env`. Nenhum objeto do bucket foi alterado nesta integração. As gravações antigas e o CI remoto da main não são evidências de execução destes commits locais.

Os 60 cenários de navegador passaram no conjunto das execuções acima. O comando completo inicial terminou com erro no limite global de 30 segundos durante `page.goto` na troca de conta da submissão mobile; um cenário posterior não chegou a executar. A repetição dos quatro cenários de submissão passou sem alterar código, timeouts ou asserções. As suítes seguintes foram executadas separadamente, com os mesmos comandos previstos no script da raiz e novos servidores. Não se declara que o primeiro comando completo passou.

Na resolução do merge, o teste de cadastro passou a abrir `/login`, pois `/` agora é a página inicial pública. Foram preservados a obrigação de cadastro antes das rotas privadas, os convites e a reprodução privada; os componentes correspondentes adotaram os estilos da interface nova. Capturas do cadastro mobile e do painel de convidados foram inspecionadas.

A cópia limpa foi extraída da árvore candidata do Git em um diretório temporário, com o mesmo código e lockfile da integração; as últimas alterações desta página apenas registram os resultados. Ela não recebeu `.env`, uploads, snapshots nem `node_modules` do projeto de trabalho. A instalação usa a rede e o cache normal do pnpm. Essa execução comprova instalação de dependências, compilação e preparação do seed no ambiente Ubuntu 26.04 existente; não equivale a preparar um sistema operacional novo nem à aceitação autônoma por outra pessoa.

## Verificações da base

As medidas abaixo foram registradas na revisão anterior do PR #58, incorporada da main. Não representam a execução atual descrita acima.

| Verificação | Resultado da base |
| --- | --- |
| `pnpm build` | Passou para API e web |
| `pnpm test` | Passou: 277 testes API + 127 web = 404 |
| API: statements / branches / funções / linhas | 98,49% / 96,91% / 98,50% / 99,29% |
| Web: statements / branches / funções / linhas | 95,62% / 92,19% / 93,43% / 96,39% |
| `pnpm test:e2e` | Passou: 46 gerais + 4 submissão + 2 notas + 2 avaliação = 54 cenários |
| Navegador | Chromium desktop e emulação mobile; capturas conferidas |
| CI da main após o merge | [Build, testes, banco e E2E aprovados](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/actions/runs/45598980600) |

Na execução histórica da base, o `tsx` encontrou bloqueio de IPC (`listen EPERM`). Para executar os E2E, os mesmos servidores foram iniciados temporariamente com `node --import tsx`; essa adaptação de ambiente foi revertida e não integra a base. O CI remoto passou com os scripts versionados. Os testes de avaliação passaram no limite original de 30 segundos. Não houve redução de cobertura ou enfraquecimento de asserções.

## Estado funcional

| Histórias | Evidência de implementação | Aceite pendente |
| --- | --- | --- |
| HU01 | Login local/Google com domínio USP ou convite, cadastro de aluno e administração; sessão e autorização | Evidência do percurso Google real e revisão docente/equipe |
| HU02 | Grupos, vínculos, auditoria, autorização e projetos | Revisão e evidências vinculadas às histórias; PR #26 é incremento antigo separado |
| HU03 | Configuração e rubricas por projeto, versões e pesos | Atualização dos checklists e aceite da equipe |
| HU04/HU05 | Upload real, R2 optativo, player/download privados, versões, snapshots, prazo, ajustes e backup | Revisão final/evidências de #43 |
| HU06/HU07 | Acompanhamento e feedback privado com contexto de versão | Revisão final de #45 e atualização das histórias |
| HU08/HU09/HU10 | Avaliações reais ligadas à consolidação, CSV e liberação | Aceite final de #44/#46; integração de notas não deve mais ser descrita como ausente |
| HU11/HU12 | Publicação e catálogo conectados a C1/C3 reais em `createApp`, bytes autorizados e retirada | Revisão cruzada e aceite humano das evidências do servidor normal |
| HU13/HU14 | Excluídas do escopo pelo usuário em 22/11/2026 | Não tratar como implementação pendente desta entrega |

Ver [histórias e critérios](historias-de-usuario.md), [arquitetura](arquitetura.md) e [manual](manual-de-uso.md). A enumeração não transforma uma issue aberta em falha funcional; revisão, evidência e aprovação são partes da definição de Done.

Nos fluxos verificados, não foi identificado bloqueio funcional após a integração: acesso USP/convidados, cadastro obrigatório, materiais e player privados, entrega, avaliação, resultado e publicação/retirada estão conectados. Isso não significa que toda a entrega acadêmica esteja aceita. A definição sobre assinaturas continua aberta; restrição etária, finanças como funcionalidade e HU13/HU14 seguem dispensadas conforme as decisões do usuário.

O requisito de custo zero também tem uma limitação operacional: os limites implementados protegem o uso da aplicação, mas não estabelecem um bloqueio de cobrança na conta R2. Não se pode garantir custo zero absoluto diante de uso externo, alterações da conta ou excedentes; ver [limites de armazenamento](arquitetura.md#cloudflare-r2-e-controle-da-franquia-gratuita). Os metadados e contadores continuam exigindo disco persistente e um processo escritor, mesmo com os vídeos no bucket.

## Critérios do enunciado e adaptação

A referência principal é o documento **Projeto da disciplina PCS3643**, complementado pelos slides de apresentação e prototipagem fornecidos pela equipe. O documento do projeto exige 85% de cobertura; os slides iniciais mencionam 80%. A configuração mantém 85% nas quatro métricas de cada pacote. Não há número mínimo de testes; há exigência de tipos, cobertura, aprovação e pelo menos cinco vídeos de funcionalidades diferentes.

| Requisito | Situação e referência |
| --- | --- |
| Web desktop/mobile, conteúdo e metadados | Implementados; interface e testes de navegador |
| Outro tipo de conteúdo | Tema acadêmico proposto; falta decisão do professor registrada |
| Cadastro e login | Google valida USP ou convite; aluno confirma nome completo, NUSP e ingresso; vínculo é definido separadamente |
| Assinatura individual/familiar e quatro acessos | Decisão em aberto; os quatro papéis acadêmicos não são planos de assinatura |
| Restrição etária | Dispensada pelo usuário no escopo definido em 22/11/2026 |
| Avaliações/comentários | Fluxo acadêmico aceito pelo usuário: rubrica de avaliadores atribuídos e feedback privado; aprovação docente formal não presumida |
| Busca e privacidade | Título, categoria, ano e turma implementados; avaliações e notas permanecem privadas conforme o fluxo acadêmico aceito |
| Histórico, vistos, favoritos e recomendações | Fora do escopo definido pelo usuário; HU13/HU14 |
| Administração de conteúdo e retirada | Finalização/publicação/retirada integradas no servidor normal; dados privados separados do catálogo |
| Histórico de consumo após retirada | Fora do escopo; a auditoria de publicação e os dados privados são preservados |
| Estatísticas, receita e custos como funcionalidades | Dispensados pelo usuário; limites operacionais de armazenamento continuam necessários |
| MVC/REST e diagramas | Código separado por camadas; diagramas atuais nesta revisão |
| Histórias, responsáveis e sprints | Registrados; revisar estados e kanban/aceite sem presumir conclusão |
| Crazy 8 e protótipos | Fotos e três escolhas existem; folhas incompletas e validação ainda pendentes |
| Testes e CI | Resultados locais atuais e da base registrados separadamente; CI remoto destes commits locais ainda não executado |
| Cinco vídeos distintos | Oito clipes existentes organizados em quatro percursos desktop/mobile; preparar índice inequívoco de cinco funcionalidades e identificar fixtures |
| Instalação autônoma Ubuntu 26.04 | Dependências, build e preparação do seed aprovados em cópia limpa no Ubuntu 26.04 LTS; preparação de SO novo e aceite independente ainda pendentes; CI permanece 24.04 |
| README, versões, uso e badges | Atualizados nesta revisão; badge de CI identifica a main remota, e cobertura atual está na tabela de verificações |
| Scripts, seed e dados da demonstração | Três contas locais e oito de desenvolvimento; CLI de cenários, WebM versionado e PDFs gerados. Projeto principal, imagem/versões e grupo de isolamento deste ambiente são dados privados a preparar em outra instalação; roteiro e ensaio final ainda exigem revisão humana |
| Prompts, modelos e versões de IA | Registro desta revisão criado; histórico de outros integrantes ainda deve ser reunido sem inventar versões |
| Apresentações e autoavaliação | Não comprováveis pelo código; confirmar com equipe/professor |
| Número do grupo, nome e compartilhamento | Confirmar; não foi enviado convite nesta revisão |

O enunciado condiciona a aceitação à instalação pelo README sem auxílio da equipe e prevê nota zero caso o sistema não possa ser instalado. Documentação não substitui testar a instalação. Para os pesos, o documento do projeto registra NP 60%, ND 30%, NA 10%; dentro de ND: arquitetura 10%, documentação 20%, testes 20%, Scrum 30% e repositório 20%. Há divergências nos slides; confirmar com o professor se necessário.

## Checklist da entrega

| Responsável | Ação | Estado |
| --- | --- | --- |
| Henrique (#42/#11) | Conectar C1/C3 e testar finalizar/publicar/retirar | Implementado e coberto; revisão cruzada e aceite humano pendentes |
| Henrique (#20) | Encerrar a definição de assinaturas e reunir o aceite docente | Decisões do usuário registradas no [escopo](../README.md#1-tema-e-escopo); aprovação docente não presumida |
| Kauê (#46/#19) | Instalação limpa Ubuntu 26.04, versões, migrations, seed, build e testes | Verificações locais e cópia limpa aprovadas nesta integração; instalação autônoma/aceite da #46 ainda exigem registro próprio |
| Enzo (#43) | Revisão de upload, submissão, reabertura, backup e vídeo | Código integrado; aceite/evidência final pendentes |
| Yuhang (#44) | Aceite da avaliação real, rubricas e reabertura | Código integrado; revisão final pendente |
| Dan (#45) | Revisão de privacidade, feedback, resultado e acervo após integração de publicação | Gravações existentes; revisar a integração atual e identificar fixtures |
| Equipe; coordenação de Kauê | Selecionar cinco vídeos distintos, nomear fluxo, autor, commit e natureza dos dados | Seleção final pendente |
| Equipe | Atualizar issues e kanban com revisão e evidências reais | Pendente |
| Equipe | Completar registro de prompts/modelos/versões e decisões do Crazy 8 | Parcial |
| Henrique + equipe | Fechar apresentação, dados e roteiro para 26/11/2026 | Roteiro e slides alinhados aos cenários de desenvolvimento; narração, ensaio e aceite da equipe pendentes |

## Documentação e evidências

- [Manual de uso](manual-de-uso.md), [instalação](instalacao-e-aceitacao.md), [arquitetura](arquitetura.md), [classes](diagrama-classes.md), [DER](diagrama-er.md), [sequências](diagramas-sequencia.md) e [estados](estados-do-projeto.md).
- [Evidências de Dan](dan-semana7.md): oito gravações de feedback, catálogo, retirada e resultado, em desktop/mobile; o documento identifica o uso de provedores de teste na publicação.
- [Registro de IA desta revisão](ia/2026-11-25-revisao-final.md). Registros históricos por sprint conservam a data/base de origem; não são declarações atualizadas de implementação.
- O `docs/Diagrama.png` é uma imagem histórica; os diagramas Mermaid desta revisão são a referência atual de arquitetura.

## Validação histórica da revisão documental da main

- Links locais dos 19 arquivos Markdown alterados/novos conferidos: sem destinos ausentes.
- Dezessete blocos Mermaid renderizados com Mermaid CLI; recortes de arquitetura, classes, DER e sequência inspecionados visualmente.
- Onze blocos de comandos shell verificados com `bash -n`; comandos pnpm conferidos contra os manifests e configurações.
- `git diff --check` sem erros; escopo restrito a Markdown, sem mudança em código, dependências, testes ou migrations.
- As suítes de aplicação não foram repetidas nesta revisão exclusivamente documental, conforme `AGENTS.md`. Os resultados da base permanecem separados acima.
