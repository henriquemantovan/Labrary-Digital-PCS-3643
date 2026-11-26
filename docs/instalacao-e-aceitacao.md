# Instalação e aceitação

Roteiro de Kauê para #41/#19, preparado em 12/11/2026. A execução final em instalação limpa Ubuntu 26.04 e os cinco vídeos pertencem à #46, de 19–25/11; este documento não declara essa aceitação concluída.

## Preparar uma instalação Linux nova

Revisão documental de 26/11/2026, sobre a integração da main e os incrementos locais de cadastro, R2, contas de teste e demonstração completa. O ambiente local desta integração é Ubuntu 26.04 LTS, x86_64; os comandos e resultados estão na [revisão final](revisao-final.md). Uma instalação independente, seguindo este roteiro em um sistema operacional recém-preparado, ainda precisa ser registrada em #46. O CI usa Ubuntu 24.04.

Instale Git, certificados, curl, tar/xz e ferramentas de compilação. Em uma máquina Ubuntu administrada pela equipe:

```sh
sudo apt-get update
sudo apt-get install -y git ca-certificates curl xz-utils build-essential
```

Se já possui gerenciador de Node, instale a versão de `.nvmrc` e pnpm 11.25.0. Como alternativa, os comandos abaixo instalam o binário oficial Node em um diretório do usuário, sem substituir o Node do sistema. Requer Linux x86_64 ou ARM64; escolha outra distribuição oficial se a arquitetura for diferente.

```sh
case "$(uname -m)" in
  x86_64) labrary_arch=x64 ;;
  aarch64|arm64) labrary_arch=arm64 ;;
  *) echo "Arquitetura não prevista neste roteiro"; exit 1 ;;
esac
labrary_tools="$HOME/.local/labrary-tools"
labrary_node="$HOME/.local/labrary-node-24.19.0"
labrary_download=$(mktemp -d)
mkdir -p "$labrary_node" "$labrary_tools"
curl -fL "https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-${labrary_arch}.tar.xz" -o "$labrary_download/node.tar.xz"
tar -xJf "$labrary_download/node.tar.xz" -C "$labrary_node" --strip-components=1
export PATH="$labrary_node/bin:$labrary_tools/bin:$PATH"
npm install --global --prefix "$labrary_tools" pnpm@11.25.0
node --version
pnpm --version
```

Mantenha o `export PATH` no shell das próximas etapas. O download fica no diretório temporário informado por `labrary_download`; não contém dados da aplicação.

```sh
git clone https://github.com/henriquemantovan/Labrary-Digital-PCS-3643.git
cd Labrary-Digital-PCS-3643
pnpm install --frozen-lockfile
pnpm build
pnpm demo
```

Abra `http://localhost:5173/login`. `/` é a página inicial pública. O seed local não requer PostgreSQL nem Google. Para instalar exatamente a mesma revisão em outra máquina, registre o commit de `git rev-parse HEAD` e a saída de `cat /etc/os-release`, `node --version` e `pnpm --version` no relatório de aceitação. Os comandos de clone obtêm a main remota; commits locais desta integração só estarão disponíveis depois de publicados pelo responsável.

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

API e web exigem no mínimo 85% nas quatro métricas. E2E usa Chromium desktop e emulação mobile; não comprova Safari ou dispositivo físico. O script da raiz executa as suítes sequencialmente, com processos/dados novos para preservar o isolamento e a cota de login.

| Suíte | Configuração | Portas API / web |
| --- | --- | --- |
| Geral e submissão | `playwright.config.ts`, `playwright.submission.config.ts` | 3002–3007 / 5179–5183; inclui o provedor OIDC de testes |
| Notas, um perfil por execução | `playwright.grades.config.ts` | 3006 / 5182 |
| Avaliação e publicação integrada | `playwright.evaluation.config.ts`, `playwright.publication.config.ts` | 3008–3009 / 5184–5185 |
| Cadastro USP e convidados via OIDC de teste | `playwright.academic.config.ts` | 3004–3005 / 5181 |
| Contas fictícias, primeiro cadastro e convite por senha | `playwright.test-accounts.config.ts` | 3010–3013 / 5186–5189 |

Não encerre processos de outras pessoas para liberar portas. Em máquina com pouca memória, pause seus servidores extras enquanto valida e restaure-os depois. `test-results/` e `packages/*/coverage/` são artefatos privados ignorados. `VITEST_MAX_WORKERS=1 pnpm test` reduz o paralelismo sem mudar testes ou limites. Os resultados já executados, inclusive timeouts e repetições isoladas, constam da [revisão de 26/11](revisao-final.md#demonstração-completa--26112026).

O CI fixa Ubuntu 24.04 para a versão atual do Playwright. A validação local desta integração usa Ubuntu 26.04; isso permite verificar a execução nessa distribuição, mas não comprova instalação autônoma por outra pessoa. Registre separadamente a preparação do sistema, o commit, os comandos e os resultados da aceitação da #46.

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

Abra <http://localhost:5173/login>; página inicial em `/`; API em <http://localhost:3000>. Encerre com Ctrl+C. O script informa o caminho de `environment.sh`; `source /caminho/informado/environment.sh && pnpm dev` reutiliza os mesmos dados para verificar reinício. Esse arquivo contém somente configuração local de demonstração. `pnpm demo --prepare-only` prepara e informa o comando sem iniciar servidores. Cada nova execução cria outro ambiente; não apaga o anterior nem altera `.env` existente. O diretório temporário pode ser limpo pelo sistema, portanto não o use para dados que precisem ser preservados.

A demonstração fornece três perfis acadêmicos, sem conta ADMIN; o roteiro docente cobre a gestão de grupos/projetos. Para demonstrar administração, use um ADMIN provisionado conforme o guia de acesso ou `admin@labrary.test` no desenvolvimento Google/PostgreSQL explicitamente habilitado. Essa conta não pertence ao seed local isolado.

No seed, a consolidação de um projeto começa em “Sem submissão”. O [roteiro HU08](hu08.md) prepara uma entrega, registra notas e valida a consolidação no servidor normal.

Para contas próprias, siga [HU01](hu01.md); para Google, [login e migrations](login-google.md). Não habilite demonstração em produção. Não sobrescreva `.env` nem copie credenciais para logs/relatórios.

## Desenvolvimento com Google, PostgreSQL e R2

`pnpm dev` usa o `.env` existente; não executa migrations nem cria usuários, turmas ou projetos automaticamente. Se ainda não existir um `.env`, copie `.env.example` uma única vez e configure-o. Não copie credenciais de outra pessoa nem sobrescreva uma configuração existente.

1. Configure o cliente OAuth e PostgreSQL conforme [login-google.md](login-google.md). Use `AUTH_PROVIDER=google`, `AUTH_DEMO=false` e remova `AUTH_USERS_FILE`.
2. Faça backup quando houver dados e aplique apenas migrations pendentes com `pnpm db:deploy`; confira `pnpm db:status`.
3. Para persistir bytes no R2, configure o bucket privado e o contador conforme a [arquitetura](arquitetura.md#cloudflare-r2-e-controle-da-franquia-gratuita). O modelo `.env.example` começa em disco; alterar o provedor não copia arquivos antigos.
4. Para as oito contas fictícias, defina `NODE_ENV=development` e `DEV_TEST_LOGIN=true`, execute `pnpm contas:teste` e inicie `pnpm dev`.
5. Em outro terminal, na raiz e com a API em execução, use `pnpm demonstracao:completa`. O comando usa o mesmo PostgreSQL e o provedor de arquivos configurado. O [roteiro completo](manual-de-uso.md#demonstração-completa-com-postgresql-e-r2) explica contas, estados e preparação complementar.

Abra `http://localhost:5173/login`. Contas reais entram pelo Google; as oito contas reservadas usam o formulário de teste e senha inicial `LabraryTeste@2026`. A exceção exige origem local e é recusada em produção. Com ela ativa, a API escuta em `127.0.0.1`. Desligue com `DEV_TEST_LOGIN=false` e reinicie; as sessões fictícias deixam de autorizar acesso, conservando dados e histórico.

O provisionamento cria contas ausentes sem substituir identidades, senhas ou papéis existentes. O convite inicial de `convidado@labrary.test` só é criado na primeira criação da conta. A preparação conserva o progresso dos projetos; cadastro concluído e convite revogado não são reiniciados. IDs e arquivos em `.data/` não acompanham o clone. Sem o `.env`, banco e bucket próprios, essas contas não existem automaticamente.

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

Pare o único processo escritor e copie conjuntamente o arquivo `PROJECT_DATA_FILE`, `GROUP_DATA_FILE` (no modo local), `RUBRIC_DATA_FILE`, `EVALUATION_DATA_FILE`, `RESULT_RELEASE_DATA_FILE` e, com `STORAGE_PROVIDER=disk`, a pasta `UPLOAD_DIR`, conservando permissões privadas. No R2, preserve os objetos pelas mesmas chaves e o arquivo `R2_USAGE_FILE`; não substitua o contador por zeros nem restaure uma cópia antiga para liberar uso. No Google, inclua backup PostgreSQL de identidades, cadastro, convites, vínculos e sessões. Não publique essas pastas. Restaure em outro diretório de teste, configure os caminhos e verifique arquivos, versões, feedback, avaliações e decisões após reinício. O [procedimento HU04](hu04.md) trata snapshots antigos e materiais sem bytes; não remova snapshots como migração. Há testes de restauração conjunta em `backupRestore.test.ts` (C1) e `evaluationRoutes.test.ts` (C1, C2 e liberação C3).

## Roteiro e divisão de evidências

| Fluxo | Responsável | Evidência final esperada |
| --- | --- | --- |
| Login e isolamento por papel | Kauê; Henrique fornece ambiente Google | Login real, recarga, logout, cookie revogado e acesso negado entre grupos/turmas |
| Envio e submissão | Enzo #43 | Upload/substituição, snapshot, bloqueio, ajustes e restauração |
| Feedback | Dan #45 | Conversa privada, versão real e persistência |
| Avaliação e consolidação | Yuhang #44 + Kauê #46 | C2 persistido real, precisão, pendências, CSV, liberação e reabertura |
| Publicação e catálogo | Henrique #42 + Dan #45 | Autorização explícita, bytes, filtros e despublicação |

Fluxos integrados: alvo 23/11; cinco vídeos: alvo 24/11; relatório e entrega a Henrique: 25/11. Até haver revisão e evidência real, manter os critérios correspondentes pendentes. Não gravar vídeo de fixture como demonstração do fluxo integrado.


## Gravação e seleção dos cinco vídeos

Execute a suíte com gravação para obter os fluxos de navegador:

```sh
RECORD_EVIDENCE=true pnpm test:e2e
```

Os vídeos são artefatos em `test-results/`, ignorados pelo Git. A gravação longa da avaliação também pode ser feita com `RECORD_EVALUATION_DEMO=1 pnpm exec playwright test --config playwright.evaluation.config.ts --project desktop`. O limite de 90 segundos nesse modo acompanha a execução deliberadamente lenta; o modo normal usa 60 segundos por cenário de avaliação. Publicação normal usa 30 segundos, com modo de gravação de 90 segundos em `pnpm demo:publicacao`.

Para entregar, selecione pelo menos cinco vídeos que demonstrem funcionalidades distintas, não apenas desktop e mobile do mesmo cenário. Proposta de índice: login/permissões; upload e substituição; submissão/devolução; feedback por versão; avaliação/consolidação/liberação. Inclua publicação/acervo integrado pelo servidor normal; a conexão real C1/C3 está implementada. Registre arquivo, funcionalidade, autor, data, commit, comandos e se há fixture. A existência do comando de gravação não comprova que a seleção final já tenha sido produzida.

Os [oito clipes existentes](dan-semana7.md) e suas limitações continuam disponíveis; não foram regenerados por esta alteração documental. O [manual](manual-de-uso.md) orienta a demonstração ao vivo.

## Checklist de aceitação em máquina nova

- [ ] Registrar SO Ubuntu 26.04, arquitetura, Node, pnpm e commit instalado.
- [ ] Instalar pelo roteiro sem ajuda dos autores e preservar o lockfile.
- [ ] Executar build, cobertura e E2E; guardar comandos, saídas e artefatos.
- [ ] No modo Google, configurar cliente real, banco, migrations, contas e turmas; distinguir de OIDC simulado.
- [ ] Demonstrar dados, arquivos e vínculos necessários sem depender de um diretório temporário perdido.
- [ ] Validar backup/restauração conjunta, mantendo dados privados fora do repositório.
- [ ] Revisar as evidências de publicação com provedores reais e registrar o aceite humano; a conexão está implementada.
- [ ] Indexar os cinco vídeos e registrar revisão cruzada, aceite e pendências.

Uma instalação de produção também exige servir `packages/web/dist` com fallback das rotas da SPA e encaminhar `/api` à API na mesma origem. `pnpm build` não inicia um servidor web de produção. Este roteiro não declara um deploy público existente.

## Incrementos integrados nesta branch

`pnpm test:e2e` também executa publicação integrada no servidor normal, cadastro USP/convidados com OIDC de teste e a exceção de contas de desenvolvimento com fixtures próprias. Publicação valida C0/C1/C2/C3/C4 reais; os testes de identidade e contas de desenvolvimento verificam suas regras sem comprovar Google real. As suítes têm processos/dados isolados e preservam o limite de login.

No modo Google, execute `pnpm db:status` e aplique apenas migrations pendentes com `pnpm db:deploy`, após backup. A migration `20261122000000_academic_profile_guests` preserva identidades/NUSP e adiciona ano de ingresso, conclusão do cadastro e histórico de convidados. As migrations anteriores são imutáveis.

Para R2, siga a [configuração privada](arquitetura.md#cloudflare-r2-e-controle-da-franquia-gratuita). Preserve `R2_USAGE_FILE` junto dos snapshots e mantenha cópia dos objetos; restaurar contadores antigos não desfaz operações contabilizadas pela Cloudflare. `pnpm demo` e os servidores E2E forçam disco e não usam o bucket da conta real.
