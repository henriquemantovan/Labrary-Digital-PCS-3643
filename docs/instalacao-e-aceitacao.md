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

O [script](../scripts/demo.sh) confere as versões e cria um diretório privado temporário novo com caminhos separados para projetos, grupos, rubricas, liberações e arquivos. Usa o seed existente `AUTH_DEMO=true`, com os projetos e vínculos da demonstração e estas contas (senha `Labrary@2026`):

| E-mail | Papel |
| --- | --- |
| `aluno@labrary.local` | Aluno do grupo 02 |
| `avaliador@labrary.local` | Avaliador do projeto 1 |
| `professor@labrary.local` | Professora da turma 1 |

Abra <http://localhost:5173>; API em <http://localhost:3000>. Encerre com Ctrl+C. O script informa o caminho de `environment.sh`; `source /caminho/informado/environment.sh && pnpm dev` reutiliza os mesmos dados para verificar reinício. Esse arquivo contém somente configuração local de demonstração. `pnpm demo --prepare-only` prepara e informa o comando sem iniciar servidores. Cada nova execução cria outro ambiente; não apaga o anterior nem altera `.env` existente. O diretório temporário pode ser limpo pelo sistema, portanto não o use para dados que precisem ser preservados.

O seed não cria avaliações/submissões fictícias no entrypoint: a consolidação normal mostra a integração C2 indisponível (503). O Playwright injeta C2 em servidores exclusivos de teste para validar tabela, CSV e liberação; isso não substitui o adapter real da HU08.

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

Pare o único processo escritor e copie conjuntamente o arquivo `PROJECT_DATA_FILE`, `GROUP_DATA_FILE` (no modo local), `RUBRIC_DATA_FILE`, `RESULT_RELEASE_DATA_FILE` e a pasta `UPLOAD_DIR`, conservando permissões privadas. No Google, inclua backup PostgreSQL de identidades, vínculos e sessões. Não publique essas pastas. Restaure em outro diretório de teste, configure os caminhos e verifique arquivos, versões, feedback e decisões após reinício. O [procedimento HU04](hu04.md) trata snapshots antigos e materiais sem bytes; não remova snapshots como migração.

## Roteiro e divisão de evidências

| Fluxo | Responsável | Evidência final esperada |
| --- | --- | --- |
| Login e isolamento por papel | Kauê; Henrique fornece ambiente Google | Login real, recarga, logout, cookie revogado e acesso negado entre grupos/turmas |
| Envio e submissão | Enzo #43 | Upload/substituição, snapshot, bloqueio, ajustes e restauração |
| Feedback | Dan #45 | Conversa privada, versão real e persistência |
| Avaliação e consolidação | Yuhang #44 + Kauê #46 | C2 persistido real, precisão, pendências, CSV, liberação e reabertura |
| Publicação e catálogo | Henrique #42 + Dan #45 | Autorização explícita, bytes, filtros e despublicação |

Fluxos integrados: alvo 23/11; cinco vídeos: alvo 24/11; relatório e entrega a Henrique: 25/11. Até haver revisão e evidência real, manter os critérios correspondentes pendentes. Não gravar vídeo de fixture como demonstração do fluxo integrado.
