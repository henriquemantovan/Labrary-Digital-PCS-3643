# Entrega de Kauê — 12/11/2026

Escopo: #36 (S5, encerrada em 11/11), mais o trabalho independente da #41 (S6, 12–18/11), conforme o plano de contribuições. Histórias de origem #1, #9, #18 e #19. A #46 (instalação final e cinco vídeos, 19–25/11) ainda não venceu. Nenhuma issue foi fechada e não se presume revisão, aceite acadêmico ou confirmação dos contratos por outro integrante.

## Código e artefatos disponíveis

- Motor de cálculo sobre o C2 de Yuhang: notas ponderadas, média das finalizadas previstas, ausência diferente de zero, parcial/final e precisão interna. Valida rubrica, escala, completude e identidade da rodada.
- CSV correspondente à tabela, com duas casas na exibição, campos escapados, UTF-8 e proteção contra fórmulas de planilha.
- [Contrato C3](contratos/c3-consolidacao.md), [exemplos JSON](contratos/c3-exemplos.json) e schemas executáveis compartilhados entre testes da API e da web. Completude das avaliações e liberação são sinais distintos; nenhum deles publica materiais.
- API/tabela docente em `/notas`, com escopo por turma, pendências, exportação, confirmação de liberação, carregamento, erros recuperáveis e retorno ao login em sessão expirada.
- Liberação explícita e auditada em arquivo privado, idempotente para a mesma revisão e restaurável após reinício. A leitura compara a decisão com o C2 atual: reabertura/nova revisão/rodada exige nova liberação.
- Endpoint de resultado restrito ao próprio grupo: não envia notas antes da liberação e não expõe histórico interno de revisões.
- [Roteiro de instalação/seed e aceitação](instalacao-e-aceitacao.md) e `pnpm demo`, com diretório de demonstração isolado e sem sobrescrever `.env` ou dados existentes.

A branch foi atualizada por fast-forward de `c15bf46` para `2a6f817`, preservando os commits da equipe e incorporando C0/C1/C2 já publicados. O cálculo reutiliza schema/validador e exemplos C2 existentes, sem criar um contrato paralelo. Alterações preexistentes do usuário, como a regra de `.gitignore` para o plano, foram preservadas.

## Verificação desta entrega

Ambiente: Ubuntu 24.04, Node 24.19.0 e pnpm 11.25.0. O terminal inicialmente oferecia Node 18 e não tinha pnpm no PATH; as versões exatas foram instaladas em diretório local de ferramentas, sem alterar dependências ou lockfile. Para usar essas ferramentas neste ambiente: `export PATH="$HOME/.local/share/labrary-toolchain/node-v24.19.0-linux-x64/bin:$PATH"`. Uma interrupção das sessões exigiu reiniciar as verificações completas; somente resultados de processos concluídos são registrados como aprovados.

| Comando/verificação | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passou, sem alteração do lockfile |
| Testes focados de autenticação/vínculos | 17 testes passaram antes da implementação |
| Testes focados de cálculo/CSV, repositório e API | 25 testes passaram após alinhar com C2 |
| Testes focados da tabela/cliente HTTP | 11 testes passaram antes de ampliar os exemplos compartilhados |
| `pnpm build` | Passou na versão final |
| `VITEST_MAX_WORKERS=1 pnpm test` | Passou: 228 testes da API e 86 da web (314) |
| `pnpm test:e2e` | Passou: 32 cenários principais + consolidação desktop + consolidação mobile (34) |
| `bash -n scripts/demo.sh` e `pnpm demo --prepare-only` | Passaram; `pnpm demo` também validou frontend, API, login e isolamento em execução |
| JSON C3, links locais e `git diff --check` | Passaram |

Falhas corrigidas durante a implementação: importação de tipo compatível com `verbatimModuleSyntax` no build web; testes da interface ajustados às asserções Vitest existentes e leitura de Blob disponível no jsdom. As bibliotecas Linux ausentes (`libnss3`, `libnspr4`, `libasound2t64`) impediam a abertura do Chromium; foram instaladas com sudo autorizado. As suítes do navegador foram separadas em processos sequenciais e os unitários executados com um worker para limitar memória; os 34 cenários continuam incluídos. Nenhuma dependência do projeto, asserção funcional ou limite de cobertura foi removido para obter aprovação.

Cobertura obtida nessa execução:

| Pacote | Statements | Branches | Funções | Linhas |
| --- | ---: | ---: | ---: | ---: |
| API | 99,61% | 97,83% | 99,47% | 100% |
| Web | 98,74% | 94,40% | 98,34% | 99,34% |

Capturas `test-results/notas-desktop.png` e `test-results/notas-mobile.png` foram inspecionadas; tabela legível e rolagem interna em mobile, sem transbordamento da página. A suíte também confirma recarga, estado antes/depois da liberação e download CSV.

O [workflow remoto consultado](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/actions/runs/43224128679), criado em 12/11/2026, estava concluído com sucesso no commit `2a6f817acb24dc8e85c4abdf3f33b5c0f4fcf739`. Esse resultado cobre a base da equipe, não as alterações locais desta entrega. O workflow continua fixado em Ubuntu 24.04 e inclui PostgreSQL descartável, build, cobertura e E2E.

## Dependências e próximos marcos

| Responsável/tarefa | Artefato ou validação pendente | Marco do plano |
| --- | --- | --- |
| Yuhang #39 / HU08 #8 | Adapter `EvaluationProvider` com avaliações persistidas e C2 coerente da rodada; confirmar consumo de revisões pelo C3 | 17/11 |
| Enzo #38 / HU05 #5 | C1 real persistido para compor avaliação/consolidação sem reconstruir snapshot | 16/11 |
| Henrique #32 e Yuhang #39 | Revisar composição de vínculos/avaliadores já disponíveis com a rodada real; grupos/autorização já estão integrados | Integração da S6 |
| Henrique e responsável pelo ambiente #1 | Cliente OAuth e acesso autorizado para validar Google real; Client ID e Client Secret ausentes no `.env` local | Reavaliar durante S6 |
| Kauê #41, Dan #40, Henrique #37 | Conectar os adapters reais C2/C3, consumir resultado do grupo e completude para finalização; revisão conjunta do C3 | 18/11 |
| Outro integrante da equipe | Revisão do código, demonstração e registro de aceite nas issues #36/#41 e backlog #21 | Antes do aceite |
| Kauê #46, Henrique #20 | Execução limpa no Ubuntu 26.04; migrations em PostgreSQL descartável e evidências finais; eventual mudança do requisito exige decisão explícita | 19–25/11 |
| Autores #42–#46 | Fluxos reais e cinco vídeos, reunidos por Kauê | Fluxos até 23/11; vídeos até 24/11 |

O entrypoint normal não inventa avaliações: retorna 503 na consolidação até a integração real C2. O servidor exclusivo de Playwright valida o novo fluxo com C2 injetado; não é prova de persistência de avaliações ou de aceite do fluxo C1 → C2 → C3 real. Google real, Ubuntu 26.04, migrations e vídeos não são declarados aprovados por testes locais com fixture. A HU09 e a conclusão integrada da #41 permanecem pendentes dessas entregas pertinentes.
