# Semana 5 — catálogo e regressão do acompanhamento

Entrega de Dan (@kiyochii) para [#35](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/35), relacionada a [#12](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/12), [#6](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/6) e ao [plano #21](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/21). Base: main `8e311b1`, incluindo materiais #31 e grupos #47. Incremento preparado para revisão; não representa aceite do catálogo público real.

## Demonstração local

Com as versões de `.nvmrc` e `package.json`, execute `pnpm install --frozen-lockfile` e `pnpm --filter @labrary/web dev`. Abra `http://localhost:5173/demo/acervo` (ou a porta informada pelo Vite). Essa rota não exige API nem login.

1. Confira o aviso permanente de dados fictícios.
2. Combine título `SEMÁFORO`, ano 2026, turma Laboratório de Sistemas Digitais e categoria Sistemas digitais: um resultado.
3. Troque o ano para 2025: estado vazio. Limpe os filtros: três exemplos.
4. Abra o semáforo: somente vídeo e relatório do exemplo C4 são apresentados. Manual não autorizado não aparece. Os exemplos não oferecem bytes nem links de download que simulem arquivos reais.
5. Volte pelo navegador: filtros preservados. Abra o monitor: nenhum material autorizado. Recarregue um detalhe e teste `/demo/acervo/999`.
6. Repita no celular e com teclado. A rota `/acervo` usa exclusivamente HTTP; até a publicação da S6 ela informa indisponibilidade, sem recorrer às fixtures.

O import dinâmico de `CatalogDemo` só existe quando `import.meta.env.DEV`. O build de produção elimina a rota e os dados de demonstração. A API não recebe endpoints nem fallback de fixtures. A interface pública real não consulta sessão nem busca dados de projetos privados.

## Contrato e implementação

- `Catalog.tsx`: apresentação responsiva, filtros, lista/detalhe, carregamento, vazio, falha com nova tentativa, 404, navegação e descarte de respostas antigas. Mantém filtros ao voltar e reconsulta detalhe pelo ID.
- `catalogClient.ts`: porta `PublicPublicationProvider` e cliente HTTP separados da apresentação. Reutiliza o schema puro C4 de `packages/api/src/models/publication.ts`, sem importar serviços/servidor. Rejeita campos extras privados, estado não publicado, URLs externas/privadas e versão incompatível.
- `fixtures/catalog.ts`: exemplos locais, incluindo o JSON compartilhado com o produtor, com cópias independentes por consulta.
- Filtros AND no conjunto carregado; `q` busca apenas título, com `trim()` e `toLocaleLowerCase("pt-BR")`, preservando acentos. Ano/turma/categoria usam igualdade. Opções permanecem disponíveis ao combinar filtros. Paginação e filtros remotos ficam para a integração da S6; o cliente já serializa os quatro parâmetros C4.
- Detalhe HTTP renderiza vídeo com controles e links somente para os materiais do DTO. Vídeo com erro informa indisponibilidade. Nenhum link privado é construído a partir de IDs internos. O schema não substitui autorização no servidor.

## Regressão da HU06

`accompanimentRegression.test.ts` usa API real via Supertest e bytes gravados em diretório temporário, sem mock de HTTP: professor atribui avaliador; aluno envia relatório v1; avaliador vincula feedback à versão real; aluno substitui por v2 e completa vídeo/manual; pendências mudam; aluno/avaliador/professor recuperam os bytes distintos e o feedback continua na v1. A revogação pelo endpoint de vínculos bloqueia projeto, histórico, mensagens e ambos os downloads na mesma sessão. Visitante recebe 401 e filtros não ampliam acesso.

Os E2E existentes também percorrem upload, substituição, histórico/download, atualização de pendências, feedback vinculado à versão antiga, recarga e negação a avaliador não atribuído. A nova suíte de catálogo exercita demonstração, quatro filtros, vazio, detalhe, ausência de manual, navegação/recarga, ID ausente e falha HTTP real da API ainda sem publicação.

## Dependências e aceite

| Responsável | Pendência | Próxima revisão proposta |
| --- | --- | --- |
| Henrique (@henriquemantovan), #37/#11; Dan, #40 | Confirmar em conjunto C4 v1; conectar `/api/catalog`, detalhe e bytes autorizados, retirada, HEAD/Range e reprodução real | 12/11/2026; integração alvo 18/11 |
| Dan (@kiyochii), #45; Henrique, #42 | Aceitar privacidade pública com API real e gravação da demonstração | 19/11/2026 |
| Outro integrante da equipe | Revisar e aprovar este incremento e registrar o aceite na #35 | Até 11/11/2026, sujeito à disponibilidade |

Não fechar #6/#12 com fixtures. Não houve alteração de schema, migrations ou adapter PostgreSQL; `db:test` não é necessário para esta alteração. Testes HTTP locais não comprovam integração Google/PostgreSQL nem publicação real. Revisão de outra pessoa não foi presumida.

## Verificação desta entrega

Execução local em 08/11/2026, Node 24.19.0 e pnpm 11.25.0, instalação com `--frozen-lockfile`, sem alterar dependências ou lockfile:

- `pnpm build`: passou para API e web.
- `pnpm test`: passou, **154 testes API + 66 web**. Inclui a nova regressão integrada e 11 testes do catálogo/cliente.
- `pnpm test:e2e`: passou, **28 cenários**, desktop 1440×960 e emulação iPhone 13 no Chromium. Inclui quatro cenários de catálogo (dois por viewport) e regressões existentes de acompanhamento, arquivos e feedback com API local real.
- `git diff --check`: passou. Build de produção inspecionado: sem rota `/demo/acervo` e sem os exemplos do catálogo.
- Capturas `test-results/catalogo-{desktop,mobile}.png` e `catalogo-detalhe-{desktop,mobile}.png` geradas; lista desktop/mobile e detalhe mobile inspecionados. Ausência de overflow horizontal verificada nos E2E. O CI já publica `test-results/` e coberturas no artefato `cobertura-e-navegador`; artefatos locais não são versionados.

| Pacote | Statements | Branches | Funções | Linhas |
| --- | ---: | ---: | ---: | ---: |
| API | 99,59% | 97,56% | 99,29% | 100% |
| Web | 98,98% | 95,62% | 98,73% | 99,68% |

Falhas intermediárias corrigidas: resolução de nomes `Catalog`/`catalog` no macOS (cliente renomeado para `catalogClient`), caminho do JSON compartilhado no teste e seletor E2E exato do campo Ano (uso do papel acessível combobox). O sandbox bloqueou portas locais com `EPERM`; testes HTTP/E2E foram executados com permissão fora dele. Nenhum timeout, limiar de cobertura ou asserção foi enfraquecido. Resultados locais não presumem sucesso do CI remoto nem aprovação de outro integrante.
