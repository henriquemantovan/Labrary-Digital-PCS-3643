# Dan — semana 7, privacidade e evidências

Entrega de 22/11/2026 para [#45](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/45), relacionada a #6, #10, #12 e #21. Base: `e006872`. A implementação de catálogo e resultado da #40 já estava integrada pelo PR #54; esta entrega amplia a validação e produz as gravações solicitadas.

## Verificado

- Catálogo anônimo: filtros combinados de título, ano, turma e categoria, estado vazio, detalhe, reprodução de vídeo, Range e bytes PDF autorizados.
- Privacidade: cria feedback privado pela API e confirma sua leitura autenticada antes de verificar sua ausência na listagem, no detalhe JSON e na tela pública. Valida o contrato C4 estrito, ausência de campos de notas, avaliações, mensagens e armazenamento, `no-store` e 401 nas rotas privadas sem sessão.
- Despublicação: bloqueia detalhe, documento, vídeo, HEAD e Range por URL direta; retira o projeto da galeria.
- Resultado do grupo: resposta mínima antes da liberação; após liberação explícita, nota 8,40, rubrica, pesos, notas por critério e comentário; outro projeto retorna 404, consolidação docente retorna 403 ao aluno e logout revoga a leitura.
- Regressões de acompanhamento e feedback: filtros e escopo do avaliador, mensagem vinculada à v1 após envio da v2, recuperação após perda da resposta sem duplicação, recarga e troca de perfis.
- Desktop e emulação mobile Chromium; asserções de largura e capturas do acervo inspecionadas. Não é validação em Safari/iPhone físico.

## Natureza da evidência e pendências

Os testes usam HTTP, API, autorização, serviços de publicação/liberação e arquivos locais reais. As decisões de publicação recebem C1/C3 de teste em `publicationFixture.ts`; resultados recebem C2 de teste em `gradesFixture.ts`. Essas entradas não são usadas pelo servidor de produção. A validação confirma os consumidores e os controles de acesso nesse ambiente, **não comprova o fluxo completo de avaliações persistidas em produção**.

- **Yuhang, #39/#44:** falta o provedor C2 persistente da avaliação, incluindo rodada, reabertura e refinalização.
- **Kauê, #41/#46:** falta conectar esse provedor ao entrypoint para consolidar/liberar resultados reais; `server.ts` ainda registra esse TODO e responde 503 de forma segura.
- **Henrique, #37/#42:** publicação e bytes já existem; falta o aceite com C1/C3 reais conectados no entrypoint. A factory de publicação recebe provedores de teste nos E2E.
- Próxima revisão proposta: 23/11/2026, verificando os adapters acima; depois repetir o fluxo completo e registrar revisão por outro integrante. Nenhuma aprovação humana foi presumida. #45 e histórias de origem não devem ser encerradas como integralmente aceitas por estas evidências.

## Gravações e capturas

Gravações automatizadas, sem narração, com contas e dados de demonstração. Os oito clipes abaixo são a seleção de entrega da #45; traces e relatórios transitórios continuam em `test-results/`, fora do Git.

| Fluxo | Desktop | Mobile |
| --- | --- | --- |
| Feedback por versão e recuperação de erro | [Vídeo](evidencias/dan-semana7/feedback-desktop.webm) | [Vídeo](evidencias/dan-semana7/feedback-mobile.webm) |
| Catálogo, filtros e vídeo autorizado | [Vídeo](evidencias/dan-semana7/catalogo-desktop.webm) | [Vídeo](evidencias/dan-semana7/catalogo-mobile.webm) |
| Retirada da publicação | [Vídeo](evidencias/dan-semana7/despublicacao-desktop.webm) | [Vídeo](evidencias/dan-semana7/despublicacao-mobile.webm) |
| Resultado antes/depois da liberação (C2 de teste) | [Vídeo](evidencias/dan-semana7/resultado-desktop.webm) | [Vídeo](evidencias/dan-semana7/resultado-mobile.webm) |
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
| `pnpm test` | Passou: 273 API + 110 web |
| `RECORD_EVIDENCE=true pnpm exec playwright test e2e/publication.spec.ts e2e/auth.spec.ts e2e/read-models.spec.ts` | Passou: 20 cenários desktop/mobile |
| `RECORD_EVIDENCE=true pnpm exec playwright test --config playwright.grades.config.ts --project desktop` | Passou: 1 cenário |
| `RECORD_EVIDENCE=true pnpm exec playwright test --config playwright.grades.config.ts --project mobile` | Passou; conclusão preservada em `.last-run.json` após reinício da sessão de trabalho |
| `git diff --check` | Passou |

Cobertura atual (statements / branches / funções / linhas): API **98,67 / 97,37 / 98,58 / 99,55%**; web **98,24 / 93,96 / 97,06 / 99,03%**. Nenhum limiar ou asserção foi reduzido.

As primeiras execuções de testes/API e navegador falharam por `listen EPERM` no sandbox; passaram com execução autorizada fora dele. Executar os dois perfis juntos na configuração de notas causou falha mobile por reutilizar o resultado liberado pelo desktop. A repetição seguiu o script existente, com um processo por perfil e armazenamento novo, e passou. Não foi defeito do produto nem se enfraqueceu a asserção de resultado bloqueado.

Não houve mudança no código de produção ou banco. A suíte completa `pnpm test:e2e` e `pnpm db:test` não foram executadas localmente nesta entrega; foram selecionados os fluxos da #45. O resultado local não comprova CI remoto. A inspeção auxiliar com `ffprobe` falhou pela ausência de `libx265.216.dylib` no Homebrew; a reprodução das gravações foi verificada com Chromium.
