# Labrary Digital

[![Build e testes](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/actions/workflows/ci.yml)
[![Cobertura mínima](https://img.shields.io/badge/cobertura_m%C3%ADnima-85%25-blue)](packages/api/vitest.config.ts)

Plataforma de gestão, avaliação e divulgação de projetos acadêmicos, desenvolvida para **PCS3643 — Laboratório de Engenharia de Software I**.

[Instalação](#instalação-no-ubuntu-2604) · [Contas de teste](#contas-de-teste) · [Roteiro de avaliação](#roteiro-de-avaliação) · [Testes](#testes) · [Documentação](#documentação)

## Funcionalidades

- Cadastro com Google USP ou convite, perfis de acesso e organização de turmas e grupos.
- Envio de vídeos, imagens e documentos, histórico de versões e reprodução privada.
- Requisitos de entrega, prazos, feedback, submissão e devolução para ajustes.
- Avaliação por critérios, consolidação de notas, exportação CSV e liberação do resultado.
- Publicação autorizada de materiais no acervo público e retirada da publicação.

## Equipe

| Integrante | GitHub |
| --- | --- |
| Henrique Mantovan | [henriquemantovan](https://github.com/henriquemantovan) |
| Enzo Pimentel | [enplo](https://github.com/enplo) |
| Dan Kiyochi | [kiyochii](https://github.com/kiyochii) |
| Yuhang | [yuhangf2333](https://github.com/yuhangf2333) |
| Kauê Barbosa | [kauebmr](https://github.com/kauebmr) |

## Instalação no Ubuntu 26.04

O frontend e a API executam no computador do professor. O ambiente fornecido utiliza **PostgreSQL remoto e Cloudflare R2 privado**; é necessário acesso à internet. Não é preciso instalar um servidor PostgreSQL local nem criar outro bucket.

Arquivos fornecidos pela equipe:

- **`labrary-codigo.tar.gz`**: código do projeto.
- **`labrary-dados-professor.tar.gz`**: `.env`, dados da demonstração e backups, enviado em privado.

**O `.env` sozinho não contém os projetos.** Extraia também os dados privados, pois projetos, avaliações e resultados utilizam arquivos JSON locais. O pacote privado contém credenciais e não deve ser publicado no Git.

### 1. Dependências do sistema

Em um terminal Bash do Ubuntu 26.04, com uma conta que possa usar `sudo`:

```sh
sudo apt-get update
sudo apt-get install -y git ca-certificates curl tar gzip xz-utils build-essential python3 openssl
```

Use um navegador Firefox ou Chrome/Chromium instalado no Ubuntu para abrir a aplicação. Playwright e suas bibliotecas de navegador são necessários somente para executar os testes automatizados, não para avaliar as telas manualmente.

| Componente | Versão/configuração |
| --- | --- |
| Sistema operacional | Ubuntu 26.04 LTS; validação local em x86_64 |
| Node.js | **24.19.0**, conforme `.nvmrc` |
| pnpm | **11.25.0**, conforme `package.json`; não usar `latest` |
| Backend/frontend/bibliotecas | Versões exatas nos manifests e em `pnpm-lock.yaml`; instalação automática pelo pnpm |
| Banco fornecido | PostgreSQL remoto **17.6**, consultado neste ambiente; testes/CI também usam PostgreSQL 18 |
| Arquivos | Cloudflare R2 privado, configurado no `.env`; snapshots e contador permanecem locais |
| Rede | HTTPS para Node/npm/R2 e, se usado, Google; conexão ao host/porta PostgreSQL do `.env` |
| Portas locais | API **3000** e interface **5173**, livres antes de iniciar |

### 2. Instalar Node e pnpm nas versões do projeto

Se as versões corretas já estiverem disponíveis, confira com `node --version` e `pnpm --version` e avance. Caso contrário, este bloco instala no diretório do usuário sem substituir o Node do Ubuntu. Os downloads vêm da [distribuição oficial do Node](https://nodejs.org/dist/v24.19.0/); o SHA-256 é conferido antes da extração.

```sh
case "$(uname -m)" in
  x86_64) labrary_arch=x64 ;;
  aarch64|arm64) labrary_arch=arm64 ;;
  *) echo "Arquitetura não contemplada neste roteiro"; exit 1 ;;
esac
labrary_node="$HOME/.local/share/labrary/node-v24.19.0"
labrary_download=$(mktemp -d)
mkdir -p "$labrary_node" "$HOME/.local/bin"
curl -fL "https://nodejs.org/dist/v24.19.0/node-v24.19.0-linux-${labrary_arch}.tar.xz" -o "$labrary_download/node.tar.xz"
curl -fL "https://nodejs.org/dist/v24.19.0/SHASUMS256.txt" -o "$labrary_download/SHASUMS256.txt"
mv "$labrary_download/node.tar.xz" "$labrary_download/node-v24.19.0-linux-${labrary_arch}.tar.xz"
(cd "$labrary_download" && sha256sum --check --ignore-missing SHASUMS256.txt)
tar -xJf "$labrary_download/node-v24.19.0-linux-${labrary_arch}.tar.xz" -C "$labrary_node" --strip-components=1
export PATH="$labrary_node/bin:$HOME/.local/bin:$PATH"
npm install --global --prefix "$HOME/.local" pnpm@11.25.0
node --version
pnpm --version
```

As duas últimas saídas devem ser `v24.19.0` e `11.25.0`. Em cada terminal novo, antes de usar o projeto, execute:

```sh
export PATH="$HOME/.local/share/labrary/node-v24.19.0/bin:$HOME/.local/bin:$PATH"
```

### 3. Extrair o código e a configuração recebidos

O exemplo considera os dois arquivos em `Downloads`; ajuste somente essa pasta se necessário. Use uma pasta de instalação nova. `--keep-old-files` evita sobrescrever uma configuração ou dados já existentes.

```sh
mkdir -p "$HOME/labrary-entrega"
tar -xzf "$HOME/Downloads/labrary-codigo.tar.gz" -C "$HOME/labrary-entrega"
cd "$HOME/labrary-entrega/Labrary-Digital-PCS-3643"
tar --keep-old-files -xzf "$HOME/Downloads/labrary-dados-professor.tar.gz"
chmod 600 .env
chmod 700 .data
```

O `.env` precisa ficar na **raiz**, ao lado de `package.json`; não em `packages/api` ou `packages/web`. Se ele foi enviado separadamente, conserve o arquivo recebido e extraia também os dados privados correspondentes. Não substitua por `.env.example` e não execute o conteúdo do `.env` como comando shell.

Se o código foi recebido por clone, extraia o pacote privado na raiz do repositório.

A configuração fornecida usa `AUTH_PROVIDER=google`, `AUTH_DEMO=false`, `NODE_ENV=development`, `DEV_TEST_LOGIN=true`, `STORAGE_PROVIDER=r2` e `APP_ORIGIN=http://localhost:5173`. As credenciais e o banco/bucket já estão provisionados. **Não rode `pnpm storage:init`**: o contador do bucket usado vem no pacote e não pode ser zerado. Não rode `pnpm demo` para avaliar esse conjunto: esse comando usa outros usuários e dados.

### 4. Instalar, compilar e iniciar

Na raiz do projeto:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm db:status
pnpm dev
```

`pnpm db:status` somente verifica as migrations do banco remoto; o ambiente fornecido já possui as seis migrations. Não é preciso `db:generate`, reaplicar `schema.sql`, instalar um servidor SQL nem executar seed novamente. Se a equipe fornecer um banco novo, ela deve aplicar `pnpm db:deploy` antes da entrega; não use reset ou baseline no banco compartilhado.

Mantenha o terminal aberto: `pnpm dev` inicia API Express e interface Vite juntas, com proxy `/api` na mesma origem. Abra **http://localhost:5173/login**. Para parar, pressione **Ctrl+C**; para continuar com os mesmos dados, execute `pnpm dev` novamente na mesma pasta, sem reextrair os dados privados.

Em outro terminal, as verificações básicas são:

```sh
curl --fail http://localhost:5173/api/health
curl --fail http://localhost:5173/api/auth/providers
```

A primeira resposta contém `"status":"ok"`; a segunda deve conter `"google":true`, `"local":true` e `"testLogin":true`. Os nomes dessas opções descrevem os métodos de login; os arquivos continuam no R2 neste ambiente.

## Contas de teste

Acesse **http://localhost:5173/login** e use o formulário **E-mail da conta de teste**. A senha inicial de todas as contas abaixo é **`LabraryTeste@2026`**.

| E-mail | Papel | O que demonstrar |
| --- | --- | --- |
| `admin@labrary.test` | Administrador | Gestão de papéis, convidados e visualização dos perfis acadêmicos |
| `professor@labrary.test` | Professor | Grupos, projetos, critérios de avaliação, notas/CSV, reabertura, publicação e retirada |
| `avaliador@labrary.test` | Avaliador | Avaliações dos projetos atribuídos, rascunho, finalização e histórico |
| `aluno@labrary.test` | Aluno | Envio e versões de materiais, player, feedback, submissão e resultado liberado |
| `aluno2@labrary.test` | Aluno | Colaboração com o primeiro aluno nos grupos da demonstração |
| `aluno3@labrary.test` | Aluno | Isolamento entre grupos e acesso restrito aos vínculos atribuídos |
| `cadastro@labrary.test` | Aluno | Primeiro cadastro com nome completo, NUSP fictício e ano de ingresso |
| `convidado@labrary.test` | Aluno convidado | Acesso sem NUSP mediante convite ativo e bloqueio após revogação |

Essas contas funcionam somente no desenvolvimento local explicitamente habilitado. Não são contas Google: o login real continua pelo botão **Entrar com Google**. Para desabilitar os acessos fictícios, defina `DEV_TEST_LOGIN=false` e reinicie a API. O modo separado `pnpm demo` usa outras contas e outra senha, descritas abaixo.

## Roteiro de avaliação

Entre em **http://localhost:5173/login** com as contas acima. Use **Sair da conta** para trocar de perfil.

| Conta | O que conferir |
| --- | --- |
| `aluno` ou `aluno2` | Materiais, versões, vídeo privado, feedback e submissão. **Em ajustes — demonstração completa** permite alterar materiais e enviar outra rodada |
| `avaliador` | **Em avaliação — demonstração completa**: preencher critérios, salvar rascunho e finalizar a avaliação |
| `professor` | Consolidação, CSV, liberação de notas e publicação. **Resultado liberado — demonstração completa** já apresenta média 9,30 |
| `admin` | Contas, papéis, convidados e **Visualizar como**, que usa os vínculos da própria conta |
| `cadastro` | Primeiro cadastro com nome completo, NUSP fictício e ano de ingresso |
| `convidado` | Acesso externo autorizado; a revogação e nova autorização são feitas pelo administrador |
| Sem login | `/acervo`: **Publicado no acervo — demonstração completa**, com vídeo e relatório; notas e feedback continuam privados |

Os endereços completos das contas estão na tabela anterior. As alterações persistem: preencher o cadastro ou alterar um projeto não é desfeito ao sair. O [manual de uso](docs/manual-de-uso.md) detalha o fluxo e as permissões.

## Demonstração local sem serviços externos

Para experimentar com dados novos, sem usar o banco e o bucket fornecidos:

```sh
pnpm demo
```

O comando usa disco e diretório temporário novos a cada execução. Esta demonstração oferece três contas, com senha **`Labrary@2026`**:

| Conta | Papel |
| --- | --- |
| `aluno@labrary.local` | Aluno |
| `avaliador@labrary.local` | Avaliador |
| `professor@labrary.local` | Professor |

Para avaliar as oito contas e os materiais já preparados no R2, utilize **`pnpm dev` com o pacote privado**, conforme a instalação acima.

## Problemas comuns

| Sintoma | Correção |
| --- | --- |
| `node`/`pnpm` não encontrado ou versão diferente | Reaplicar o `export PATH` do passo 2 no terminal usado |
| API informa configuração Google incompleta | Conferir se o `.env` recebido está na raiz; não usar o modelo vazio |
| Controle R2 ausente ou de outra conta | Recolocar os dados privados correspondentes ao `.env`; não criar contador zerado |
| Interface abre, mas login/API falham | Conferir mensagens da API no terminal e executar os dois `curl` acima |
| Vite tenta abrir 5174 ou aparece erro de origem/OAuth | Liberar 5173 e 3000 antes de iniciar; a origem fornecida é `localhost:5173` |
| Erro de conexão PostgreSQL/R2 | Verificar internet, acesso ao host/porta do banco e HTTPS do bucket |
| Muitas tentativas de login (`429`) | Aguardar a janela indicada ou reiniciar a API local; limite de 20 tentativas/IP em 15 minutos |
| Convidado bloqueado após revogação | Autorizar novamente seu endereço com a conta ADMIN; isso não é falha de senha |

## Testes

Build e testes unitários não precisam de outro banco nem acessam o bucket do professor:

```sh
pnpm build
pnpm test
```

Para os testes de navegador no **Ubuntu 26.04**, instale as bibliotecas explicitamente. O instalador `--with-deps` do Playwright 1.56.1 não reconhece essa distribuição; não é necessário trocar a versão do projeto.

```sh
sudo apt-get install -y \
  xvfb fonts-noto-color-emoji fonts-unifont libfontconfig1 libfreetype6 \
  xfonts-cyrillic xfonts-scalable fonts-liberation fonts-ipafont-gothic \
  fonts-wqy-zenhei fonts-tlwg-loma-otf fonts-freefont-ttf \
  libasound2t64 libatk-bridge2.0-0t64 libatk1.0-0t64 libatspi2.0-0t64 \
  libcairo2 libcups2t64 libdbus-1-3 libdrm2 libgbm1 libglib2.0-0t64 \
  libnspr4 libnss3 libpango-1.0-0 libx11-6 libxcb1 libxcomposite1 \
  libxdamage1 libxext6 libxfixes3 libxkbcommon0 libxrandr2
case "$(uname -m)" in
  x86_64) labrary_playwright_platform=ubuntu24.04-x64 ;;
  aarch64|arm64) labrary_playwright_platform=ubuntu24.04-arm64 ;;
  *) echo "Arquitetura não contemplada nos testes de navegador"; exit 1 ;;
esac
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE="$labrary_playwright_platform" pnpm exec playwright install chromium
pnpm test:e2e
```

O CI utiliza Ubuntu 24.04. No Ubuntu 26.04, a variável de plataforma acima permite baixar o Chromium compatível sem alterar as dependências do projeto.

- `pnpm test`: testes da API e da interface, com cobertura mínima de **85% nas quatro métricas de cada pacote**.
- `pnpm test:e2e`: fluxos de navegador em desktop e celular emulado, com dados isolados.
- `pnpm db:test`: integração com PostgreSQL descartável; exige banco próprio com permissão `CREATEDB`. Não utilizar o banco compartilhado da avaliação.

Validação local em **26/11/2026**, no Ubuntu 26.04 x86_64: build, **330 testes da API e 141 da interface** aprovados, com cobertura acima de 85% nas quatro métricas de cada pacote. Os **68 cenários de navegador** passaram no conjunto das execuções; o comando integral atingiu o limite global de 60 segundos na avaliação desktop, que passou na repetição isolada. As demais suítes foram concluídas separadamente.

A instalação em cópia separada, as oito contas e a reprodução privada/pública no R2 também foram conferidas. A validação utilizou um Ubuntu existente, não uma instalação nova do sistema operacional. O badge acompanha o CI da branch `main`.

## Estrutura e persistência

Monorepo pnpm com **Node 24.19.0**, **pnpm 11.25.0**, API Express/TypeScript e interface React/Vite. As versões das bibliotecas estão nos manifests e em `pnpm-lock.yaml`.

```text
packages/api/       API, regras de negócio e persistência
packages/web/       Interface React
packages/api/prisma/  Schema e migrations PostgreSQL
e2e/                Testes de navegador
docs/               Documentação, protótipos e evidências
```

| Dados | Onde ficam no ambiente fornecido |
| --- | --- |
| Contas, vínculos, convidados e sessões | PostgreSQL remoto |
| Projetos, materiais, mensagens, critérios de avaliação, avaliações e resultados | Arquivos privados em `.data/` |
| Vídeos, imagens e documentos enviados | Bucket privado Cloudflare R2 |
| Controle de uso do R2 | Arquivo privado em `.data/`, preservado entre reinícios |

Execute **uma única API** sobre esse conjunto de dados. Durante a avaliação, a equipe deve manter sua cópia parada. Não apague nem restaure um contador antigo do R2. A franquia gratuita possui limites; os controles da aplicação não garantem bloqueio de cobrança pelo provedor.

Para continuar depois de parar a aplicação, execute `pnpm dev` na mesma pasta, sem extrair os dados novamente. Procedimentos para um ambiente próprio e backups estão em [configuração e backup](docs/instalacao-e-aceitacao.md).

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Manual de uso](docs/manual-de-uso.md) | Permissões, materiais, entrega, avaliação e publicação |
| [Configuração e backup](docs/instalacao-e-aceitacao.md) | Banco novo, preparação de dados e preservação da instalação |
| [Login Google](docs/login-google.md) | Configuração OAuth, cadastro USP e convidados |
| [Arquitetura](docs/arquitetura.md) e [API REST](docs/api-inicial.md) | Componentes, persistência e endpoints |
| [Classes](docs/diagrama-classes.md), [DER](docs/diagrama-er.md), [sequências](docs/diagramas-sequencia.md) e [estados](docs/estados-do-projeto.md) | Diagramas do sistema |
| [Histórias de usuário](docs/historias-de-usuario.md) e [planejamento](docs/planejamento.md) | Requisitos e organização do desenvolvimento |
| [Crazy 8](docs/crazy8/README.md) e [protótipos](docs/prototipos) | Ideação e telas desktop/mobile |
| [Vídeos e capturas](docs/evidencias/dan-semana7) | Gravações e capturas disponíveis |
| [Apresentação](docs/apresentacao-final.html) e [PDF](docs/apresentacao-final.pdf) | Introdução ao projeto, seguida das telas e funcionalidades capturadas com `pnpm dev` |
| [Uso de IA](docs/ia/README.md) | Declaração de auxílio no desenvolvimento e na revisão |

Para abrir a apresentação de telas no navegador:

```sh
xdg-open docs/apresentacao-final.html
```

Use as setas para navegar, **Sumário** para escolher um assunto e **Foco na tela** para ocultar as legendas dos prints. A abertura apresenta objetivo, equipe, perfis e arquitetura; depois vêm as 19 telas do sistema. As capturas acompanham o HTML em `docs/evidencias/apresentacao/`; a versão PDF reúne os 24 slides em um único arquivo. A apresentação pode ser consultada sem iniciar o servidor.

As instruções de desenvolvimento estão em [AGENTS.md](AGENTS.md), com as skills compartilhadas em [.agents/skills](.agents/skills).
