# Revisão final: situação, critérios e evidências

Revisão documental de 25/11/2026, sobre `c2dbb7fdc38787dc2244d4805a4efb28f52534b9`, após merge do PR #58. Esta revisão não altera funcionalidades, não encerra issues e não registra aprovação acadêmica ou revisão humana que não tenha sido comprovada.

## Verificações da base

As medidas abaixo foram obtidas na validação anterior do PR #58 nesta sessão de trabalho. Não são uma nova execução das suítes durante a alteração documental.

| Verificação | Resultado da base |
| --- | --- |
| `pnpm build` | Passou para API e web |
| `pnpm test` | Passou: 277 testes API + 127 web = 404 |
| API: statements / branches / funções / linhas | 98,49% / 96,91% / 98,50% / 99,29% |
| Web: statements / branches / funções / linhas | 95,62% / 92,19% / 93,43% / 96,39% |
| `pnpm test:e2e` | Passou: 46 gerais + 4 submissão + 2 notas + 2 avaliação = 54 cenários |
| Navegador | Chromium desktop e emulação mobile; capturas conferidas |
| CI da main após o merge | [Build, testes, banco e E2E aprovados](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/actions/runs/45598980600) |

Na execução local, o `tsx` encontrou bloqueio de IPC (`listen EPERM`). Para executar os E2E, os mesmos servidores foram iniciados temporariamente com `node --import tsx`; essa adaptação de ambiente foi revertida e não integra a base. O CI remoto passou com os scripts versionados. Os testes de avaliação passaram no limite original de 30 segundos. Não houve redução de cobertura ou enfraquecimento de asserções.

## Estado funcional

| Histórias | Evidência de implementação | Aceite pendente |
| --- | --- | --- |
| HU01 | Login local/Google, sessão e autorização; E2E e CI | Google real com cliente configurado e revisão docente/equipe |
| HU02 | Grupos, vínculos, auditoria, autorização e projetos | Revisão e evidências vinculadas às histórias; PR #26 é incremento antigo separado |
| HU03 | Configuração e rubricas por projeto, versões e pesos | Atualização dos checklists e aceite da equipe |
| HU04/HU05 | Upload real, versões, snapshots, prazo, reabertura, ajustes e backup | Revisão final/evidências de #43 |
| HU06/HU07 | Acompanhamento e feedback privado com contexto de versão | Revisão final de #45 e atualização das histórias |
| HU08/HU09/HU10 | Avaliações reais ligadas à consolidação, CSV e liberação | Aceite final de #44/#46; integração de notas não deve mais ser descrita como ausente |
| HU11/HU12 | Serviço de publicação, catálogo, arquivos autorizados e retirada | Conectar `publicationProviders` reais no bootstrap; aceitar o fluxo sem doubles |
| HU13/HU14 | Critérios e planejamento | Histórico de consumo, vistos, favoritos, recomendações e estatísticas não implementados |

Ver [histórias e critérios](historias-de-usuario.md), [arquitetura](arquitetura.md) e [manual](manual-de-uso.md). A enumeração não transforma uma issue aberta em falha funcional; revisão, evidência e aprovação são partes da definição de Done.

## Critérios do enunciado e adaptação

A referência principal é o documento **Projeto da disciplina PCS3643**, complementado pelos slides de apresentação e prototipagem fornecidos pela equipe. O documento do projeto exige 85% de cobertura; os slides iniciais mencionam 80%. A configuração mantém 85% nas quatro métricas de cada pacote. Não há número mínimo de testes; há exigência de tipos, cobertura, aprovação e pelo menos cinco vídeos de funcionalidades diferentes.

| Requisito | Situação e referência |
| --- | --- |
| Web desktop/mobile, conteúdo e metadados | Implementados; interface e testes de navegador |
| Outro tipo de conteúdo | Tema acadêmico proposto; falta decisão do professor registrada |
| Cadastro e login | Local e Google implementados; novo usuário Google começa sem vínculo |
| Assinatura individual/familiar, quatro acessos e idade | Não implementados; dispensa/adaptação não registrada |
| Avaliações/comentários públicos | Substituídos por rubrica e feedback privado; substituição ainda depende de aprovação |
| Busca por categoria/metadados/avaliações | Categoria e metadados implementados; filtro por avaliação não identificado |
| Histórico, vistos, favoritos e recomendações | Não implementados; HU13/HU14 |
| Administração de conteúdo e retirada | Serviço existente; primeira finalização/publicação real bloqueada pela integração |
| Histórico de consumo após retirada | Auditoria de publicação existe, histórico de consumo não implementado |
| Estatísticas, receita e custos | Não implementados; decisão de dispensa pendente |
| MVC/REST e diagramas | Código separado por camadas; diagramas atuais nesta revisão |
| Histórias, responsáveis e sprints | Registrados; revisar estados e kanban/aceite sem presumir conclusão |
| Crazy 8 e protótipos | Fotos e três escolhas existem; folhas incompletas e validação ainda pendentes |
| Testes e CI | Base validada conforme tabela de verificações |
| Cinco vídeos distintos | Oito clipes existentes organizados em quatro percursos desktop/mobile; preparar índice inequívoco de cinco funcionalidades e identificar fixtures |
| Instalação autônoma Ubuntu 26.04 | Roteiro disponível; execução limpa na versão exigida ainda não comprovada; CI é 24.04 |
| README, versões, uso e badges | Atualizados nesta revisão; cobertura dos badges é snapshot identificado |
| Scripts, seed e dados da demonstração | Scripts e seed existentes; falta fechar pacote com materiais e dados necessários à apresentação |
| Prompts, modelos e versões de IA | Registro desta revisão criado; histórico de outros integrantes ainda deve ser reunido sem inventar versões |
| Apresentações e autoavaliação | Não comprováveis pelo código; confirmar com equipe/professor |
| Número do grupo, nome e compartilhamento | Confirmar; não foi enviado convite nesta revisão |

O enunciado condiciona a aceitação à instalação pelo README sem auxílio da equipe e prevê nota zero caso o sistema não possa ser instalado. Documentação não substitui testar a instalação. Para os pesos, o documento do projeto registra NP 60%, ND 30%, NA 10%; dentro de ND: arquitetura 10%, documentação 20%, testes 20%, Scrum 30% e repositório 20%. Há divergências nos slides; confirmar com o professor se necessário.

## Checklist da entrega

| Responsável | Ação | Estado |
| --- | --- | --- |
| Henrique (#42/#11) | Conectar produtores reais C1/C3 ao serviço de publicação e validar finalizar/publicar/retirar | Pendente |
| Henrique (#20) | Registrar resposta do professor sobre tema, assinaturas, idade, receita e complementos | Pendente; texto preparado em [escopo](escopo-academico.md) |
| Kauê (#46/#19) | Instalação limpa Ubuntu 26.04, versões, migrations, seed, build e testes | Pendente de evidência |
| Enzo (#43) | Revisão de upload, submissão, reabertura, backup e vídeo | Código integrado; aceite/evidência final pendentes |
| Yuhang (#44) | Aceite da avaliação real, rubricas e reabertura | Código integrado; revisão final pendente |
| Dan (#45) | Revisão de privacidade, feedback, resultado e acervo após integração de publicação | Gravações existentes; publicação depende da conexão real |
| Equipe; coordenação de Kauê | Selecionar cinco vídeos distintos, nomear fluxo, autor, commit e natureza dos dados | Seleção final pendente |
| Equipe | Atualizar issues e kanban com revisão e evidências reais | Pendente |
| Equipe | Completar registro de prompts/modelos/versões e decisões do Crazy 8 | Parcial |
| Henrique + equipe | Fechar apresentação, dados e roteiro para 26/11/2026 | Pendente de confirmação |

## Documentação e evidências

- [Manual de uso](manual-de-uso.md), [instalação](instalacao-e-aceitacao.md), [arquitetura](arquitetura.md), [classes](diagrama-classes.md), [DER](diagrama-er.md), [sequências](diagramas-sequencia.md) e [estados](estados-do-projeto.md).
- [Evidências de Dan](dan-semana7.md): oito gravações de feedback, catálogo, retirada e resultado, em desktop/mobile; o documento identifica o uso de provedores de teste na publicação.
- [Registro de IA desta revisão](ia/2026-11-25-revisao-final.md). Registros históricos por sprint conservam a data/base de origem; não são declarações atualizadas de implementação.
- O `docs/Diagrama.png` é uma imagem histórica; os diagramas Mermaid desta revisão são a referência atual de arquitetura.

## Validação desta revisão documental

- Links locais dos 19 arquivos Markdown alterados/novos conferidos: sem destinos ausentes.
- Dezessete blocos Mermaid renderizados com Mermaid CLI; recortes de arquitetura, classes, DER e sequência inspecionados visualmente.
- Onze blocos de comandos shell verificados com `bash -n`; comandos pnpm conferidos contra os manifests e configurações.
- `git diff --check` sem erros; escopo restrito a Markdown, sem mudança em código, dependências, testes ou migrations.
- As suítes de aplicação não foram repetidas nesta revisão exclusivamente documental, conforme `AGENTS.md`. Os resultados da base permanecem separados acima.
