# Instalação e preparação da aceitação

Roteiro de Kauê para #41/#19, preparado em 12/11/2026. A execução final em instalação limpa Ubuntu 26.04 e os cinco vídeos pertencem à #46, de 19–25/11; este documento não declara essa aceitação concluída.

## Ambiente e instalação

Use Node.js **24.19.0** (`.nvmrc`), pnpm **11.25.0** (`package.json`) e o lockfile versionado. Não use versões diferentes para contornar uma falha.

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

API e web exigem no mínimo 85% nas quatro métricas. E2E inclui Chromium desktop e emulação mobile; não comprova Safari ou dispositivo físico. A suíte principal usa as portas 3002–3005 e 5179–5181. A suíte de submissão roda em seguida com servidores novos nessas portas, preservando a cota de login por IP sem interferência dos demais cenários. Depois, a suíte de consolidação usa 3006/5182, primeiro desktop e depois mobile, com servidores novos para cada perfil. Isso limita o número de processos simultâneos e conserva os cenários e o isolamento. Não encerre processos de outras pessoas para liberar portas. `test-results/` e `packages/*/coverage/` são evidências locais ignoradas pelo Git. Em máquina com pouca memória, `VITEST_MAX_WORKERS=1 pnpm test` executa os mesmos testes e limites de cobertura com um worker.

O CI fixa Ubuntu 24.04 para a versão atual do Playwright. A exigência acadêmica de Ubuntu 26.04 permanece: rodar a instalação nessa distribuição na #46, registrar versão do SO, comandos e resultados. CI 24.04 e uma máquina 24.04 não demonstram equivalência; qualquer mudança de requisito depende de decisão explícita acompanhada por Henrique (#20).

## Seed local isolado

Depois de instalar as dependências:

```sh
pnpm demo
```

O [script](../scripts/demo.sh) confere as versões e cria um diretório privado temporário novo com caminhos separados para projetos, grupos, rubricas, avaliações, liberações e arquivos. Usa o seed existente `AUTH_DEMO=true`, com os projetos e vínculos da demonstração e estas contas (senha `Labrary@2026`):

| E-mail | Papel |
| --- | --- |
| `aluno@labrary.local` | Aluno do grupo 02 |
| `avaliador@labrary.local` | Avaliador do projeto 1 |
| `professor@labrary.local` | Professora da turma 1 |

Abra <http://localhost:5173>; API em <http://localhost:3000>. Encerre com Ctrl+C. O script informa o caminho de `environment.sh`; `source /caminho/informado/environment.sh && pnpm dev` reutiliza os mesmos dados para verificar reinício. Esse arquivo contém somente configuração local de demonstração. `pnpm demo --prepare-only` prepara e informa o comando sem iniciar servidores. Cada nova execução cria outro ambiente; não apaga o anterior nem altera `.env` existente. O diretório temporário pode ser limpo pelo sistema, portanto não o use para dados que precisem ser preservados.

No seed, a consolidação de um projeto começa em “Sem submissão”. O [roteiro HU08](hu08.md) prepara uma entrega, registra notas e valida a consolidação no servidor normal.

Com a integração S7, a HU11 consome essa mesma fonte real. O [manual do usuário](manual-usuario.md) conduz até publicação e retirada; a [validação da entrega](../README.md#validação-da-entrega) distingue verificações automatizadas e aceite humano. `pnpm demo:publicacao` executa e grava o roteiro automatizado em desktop com dados novos e isolados, após instalar Chromium; não altera o ambiente aberto por `pnpm demo`.

Para contas próprias, siga [HU01](hu01.md); para Google, [login e migrations](login-google.md). Não habilite demonstração em produção. Não sobrescreva `.env` nem copie credenciais para logs/relatórios.

## PostgreSQL e migrations

O modo de demonstração não precisa de PostgreSQL. Para o modo Google, configure um banco vazio e aplique as migrations imutáveis:

```sh
pnpm db:deploy
pnpm db:status
```

Se o SQL inicial já tiver sido aplicado, faça a adoção da baseline conforme [login-google.md](login-google.md); não reaplique o schema nem apague dados. As contas locais não fazem seed de usuários Google; use o provisionamento documentado.

Em **cluster descartável** com permissão CREATEDB:

```sh
TEST_DATABASE_URL=postgresql://usuario:senha@localhost:5432/postgres pnpm db:test
```

O teste cria e remove bancos próprios para instalação limpa e adoção da baseline. Não aponte `TEST_DATABASE_URL` para infraestrutura de produção. Registre o resultado da execução quando houver serviço disponível; build/unitários não comprovam migrations em PostgreSQL real.

## Backup e restauração de teste

Pare o único processo escritor e copie conjuntamente o arquivo `PROJECT_DATA_FILE`, `GROUP_DATA_FILE` (no modo local), `RUBRIC_DATA_FILE`, `EVALUATION_DATA_FILE`, `RESULT_RELEASE_DATA_FILE` e a pasta `UPLOAD_DIR`, conservando permissões privadas. No Google, inclua backup PostgreSQL de identidades, vínculos e sessões. Não publique essas pastas. Restaure em outro diretório de teste, configure os caminhos e verifique arquivos, versões, feedback, avaliações e decisões após reinício. O [procedimento HU04](hu04.md) trata snapshots antigos e materiais sem bytes; não remova snapshots como migração. Há testes de restauração conjunta em `backupRestore.test.ts` (C1) e `evaluationRoutes.test.ts` (C1, C2 e liberação C3).

## Roteiro e divisão de evidências

| Fluxo | Responsável | Evidência final esperada |
| --- | --- | --- |
| Login e isolamento por papel | Kauê; Henrique fornece ambiente Google | Login real, recarga, logout, cookie revogado e acesso negado entre grupos/turmas |
| Envio e submissão | Enzo #43 | Upload/substituição, snapshot, bloqueio, ajustes e restauração |
| Feedback | Dan #45 | Conversa privada, versão real e persistência |
| Avaliação e consolidação | Yuhang #44 + Kauê #46 | C2 persistido real, precisão, pendências, CSV, liberação e reabertura |
| Publicação e catálogo | Henrique #42 + Dan #45 | Autorização explícita, bytes, filtros e despublicação |

Fluxos integrados: alvo 23/11; cinco vídeos: alvo 24/11; relatório e entrega a Henrique: 25/11. Até haver revisão e evidência real, manter os critérios correspondentes pendentes. Não gravar vídeo de fixture como demonstração do fluxo integrado.

## Execução adicional de publicação real — S7

`pnpm test:e2e` inclui, ao final, `playwright.publication.config.ts`. Essa configuração usa o entrypoint normal e os mesmos adapters da aplicação, com dados separados por execução e perfil, nas portas 3008/3009 e 5184/5185. Roda depois da suíte de avaliação, que usa essas mesmas portas e encerra seus servidores antes da próxima etapa. As suítes isoladas de publicação com provedores de teste continuam nas portas 3006/3007 e 5182/5183; não confundir suas capturas com aceite da integração real.

`pnpm demo:publicacao` conserva o vídeo do roteiro automatizado em `test-results/publication/`, com capturas de publicação, acervo e retirada. O comando usa as mesmas verificações do E2E normal, com movimentos mais lentos apenas para a gravação. Não substitui a revisão/narração dos responsáveis pelos cinco fluxos da apresentação.
