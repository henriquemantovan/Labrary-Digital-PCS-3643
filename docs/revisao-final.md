# Revisão final: situação, critérios e evidências

Revisão da integração de 25/11/2026: `origin/main` em `d9f7d83` mais os incrementos de Henrique preservados até `95a5148`. Os resultados históricos da base seguem identificados separadamente. Esta revisão não encerra issues nem presume aprovação acadêmica ou revisão humana.

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
| Scripts, seed e dados da demonstração | Scripts e seed existentes; falta fechar pacote com materiais e dados necessários à apresentação |
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
| Henrique + equipe | Fechar apresentação, dados e roteiro para 26/11/2026 | Pendente de confirmação |

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
