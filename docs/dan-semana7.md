# Dan — semana 7, privacidade e evidências

Entrega de 22/11/2026 para [#45](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/45), relacionada a #6, #10, #12 e #21. Base inicial: `e006872`; atualização da `main` `4b11f5b` (PR #56) incorporada durante a entrega. A implementação de catálogo e resultado da #40 já estava integrada pelo PR #54; esta entrega amplia a validação e produz as gravações solicitadas.

## Verificado

- Catálogo anônimo: filtros combinados de título, ano, turma e categoria, estado vazio, detalhe, reprodução de vídeo, Range e bytes PDF autorizados.
- Privacidade: cria feedback privado pela API e confirma sua leitura autenticada antes de verificar sua ausência na listagem, no detalhe JSON e na tela pública. Valida o contrato C4 estrito, ausência de campos de notas, avaliações, mensagens e armazenamento, `no-store` e 401 nas rotas privadas sem sessão.
- Despublicação: bloqueia detalhe, documento, vídeo, HEAD e Range por URL direta; retira o projeto da galeria.
- Resultado do grupo: resposta mínima antes da liberação; após liberação explícita, nota 8,40, rubrica, pesos, notas por critério e comentário; outro projeto retorna 404, consolidação docente retorna 403 ao aluno e logout revoga a leitura.
- Regressões de acompanhamento e feedback: filtros e escopo do avaliador, mensagem vinculada à v1 após envio da v2, recuperação após perda da resposta sem duplicação, recarga e troca de perfis.
- Desktop e emulação mobile Chromium; asserções de largura e capturas do acervo inspecionadas. Não é validação em Safari/iPhone físico.

## Natureza da evidência e pendências

Os testes usam HTTP, API, autorização, serviços de publicação/liberação e arquivos locais reais. As decisões de publicação recebem C1/C3 de teste em `publicationFixture.ts`. O cenário antigo de resultados usa C2 de teste em `gradesFixture.ts`; ele foi mantido como teste de contrato.

Durante esta entrega, a equipe integrou o PR #56: **Yuhang entregou C2 persistente e o entrypoint passou a conectá-lo à consolidação/liberação de Kauê**. A suíte `evaluation.spec.ts` agora comprova o resultado com upload, submissão, avaliação e liberação reais, incluindo bloqueio antes da liberação, isolamento entre grupos, comentários por critério e ocultação após reabertura. As gravações de resultado desta entrega usam esse fluxo real, com dados de demonstração e persistência em arquivos privados. O teste também preserva a rubrica da rodada anterior ao submeter outra rodada.

- **Henrique, #37/#42:** publicação e bytes já existem; falta conectar os provedores reais de finalização/publicação no entrypoint e aceitar esse fluxo integrado. `createApp` ainda recebe `publicationProviders` apenas por injeção. O cenário público comprova autorização e retirada com API/bytes reais, mas seus pré-requisitos de decisão vêm de contratos de teste.
- Próxima revisão proposta: 23/11/2026, verificando essa integração e registrando revisão por outro integrante. Nenhuma aprovação humana foi presumida. #45 e histórias de origem não devem ser encerradas como integralmente aceitas por estas evidências.

## Gravações e capturas

Gravações automatizadas, sem narração, com contas e dados de demonstração, atualizadas após incorporar o PR #56. Os oito clipes abaixo são a seleção de entrega da #45; traces e relatórios transitórios continuam em `test-results/`, fora do Git.

| Fluxo | Desktop | Mobile |
| --- | --- | --- |
| Feedback por versão e recuperação de erro | [Vídeo](evidencias/dan-semana7/feedback-desktop.webm) | [Vídeo](evidencias/dan-semana7/feedback-mobile.webm) |
| Catálogo, filtros e vídeo autorizado | [Vídeo](evidencias/dan-semana7/catalogo-desktop.webm) | [Vídeo](evidencias/dan-semana7/catalogo-mobile.webm) |
| Retirada da publicação | [Vídeo](evidencias/dan-semana7/despublicacao-desktop.webm) | [Vídeo](evidencias/dan-semana7/despublicacao-mobile.webm) |
| Entrega, avaliação e resultado reais, incluindo reabertura | [Vídeo](evidencias/dan-semana7/resultado-desktop.webm) | [Vídeo](evidencias/dan-semana7/resultado-mobile.webm) |
| Acervo | [Captura](evidencias/dan-semana7/acervo-real-desktop.png) | [Captura](evidencias/dan-semana7/acervo-real-mobile.png) |
| Feedback | [Captura](evidencias/dan-semana7/feedback-desktop.png) | [Captura](evidencias/dan-semana7/feedback-mobile.png) |
| Acompanhamento | [Captura](evidencias/dan-semana7/acompanhamento-desktop.png) | [Captura](evidencias/dan-semana7/acompanhamento-mobile.png) |
| Resultado | [Captura](evidencias/dan-semana7/resultado-desktop.png) | [Captura](evidencias/dan-semana7/resultado-mobile.png) |

## Execução local

Node 24.19.0 e pnpm 11.25.0 preparados em `/tmp/labrary-s7-tools`; lockfile e dependências do projeto preservados.

| Comando | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passou, sem alteração do lockfile; aviso de consulta de atualização do pnpm sem rede |
| `pnpm build` | Passou, API e web |
| `pnpm test` | Passou: 277 API + 113 web |
| `RECORD_EVIDENCE=true pnpm exec playwright test e2e/publication.spec.ts e2e/auth.spec.ts e2e/read-models.spec.ts` | Passou: 20 cenários desktop/mobile |
| `RECORD_EVIDENCE=true pnpm exec playwright test --config playwright.grades.config.ts --project desktop` | Passou: 1 cenário |
| `RECORD_EVIDENCE=true pnpm exec playwright test --config playwright.grades.config.ts --project mobile` | Passou; conclusão preservada em `.last-run.json` após reinício da sessão de trabalho |
| `RECORD_EVIDENCE=true pnpm test:e2e` (após integração do PR #56) | Passou: 44 cenários gerais + 4 submissão + 2 notas + 2 avaliação real = 52 |
| `git diff --check` | Passou |

Cobertura atual (statements / branches / funções / linhas): API **98,49 / 96,91 / 98,50 / 99,29%**; web **97,41 / 92,79 / 96,15 / 98,55%**. Nenhum limiar ou asserção foi reduzido.

As primeiras execuções de testes/API e navegador falharam por `listen EPERM` no sandbox; passaram com execução autorizada fora dele. Executar os dois perfis juntos na configuração de notas causou falha mobile por reutilizar o resultado liberado pelo desktop. A repetição seguiu o script existente, com um processo por perfil e armazenamento novo, e passou. Não foi defeito do produto nem se enfraqueceu a asserção de resultado bloqueado.

Não houve mudança própria no código de produção ou banco. Após incorporar o PR #56 da equipe, a suíte completa `pnpm test:e2e` foi executada para validar a integração. `pnpm db:test` não foi executado localmente nesta entrega. O resultado local não comprova CI remoto. A inspeção auxiliar com `ffprobe` falhou pela ausência de `libx265.216.dylib` no Homebrew; a reprodução das gravações foi verificada com Chromium.
