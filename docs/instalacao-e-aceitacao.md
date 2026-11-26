# Configuração e backup

Para usar o ambiente fornecido ao professor, siga o [README](../README.md#instalação-no-ubuntu-2604). Este guia reúne os procedimentos adicionais para manter a instalação ou configurar um ambiente próprio.

## Ambiente fornecido

A equipe entrega código e um pacote privado com `.env`, dump PostgreSQL e cópia dos objetos R2. O sistema utiliza o PostgreSQL e o R2 remotos; os backups não precisam ser restaurados para iniciar a avaliação.

Extraia a configuração na raiz do código. Os projetos, avaliações e controle R2 já estão no PostgreSQL; preserve o `.env` recebido. Não execute seed, reset ou `pnpm storage:init` sobre esse ambiente já preparado.

## Banco próprio

Use um PostgreSQL acessível pela `DATABASE_URL` do seu `.env`. Após configurar o [login Google](login-google.md), instale as dependências e aplique as migrations:

```sh
pnpm install --frozen-lockfile
pnpm db:deploy
pnpm db:status
```

Não reaplique `schema.sql` em um banco já migrado. A adoção de um banco antigo criado pelo SQL inicial exige backup e conferência do schema antes de `pnpm db:baseline`; esse comando não é usado em banco vazio.

Para arquivos R2, configure um bucket privado conforme a [arquitetura](arquitetura.md#armazenamento-de-arquivos). `pnpm storage:init` só inicializa o contador de uma configuração nova sem consumo anterior no mês; não deve zerar ou substituir controles existentes.

## Preparar dados de desenvolvimento

Somente em um ambiente próprio já configurado com Google, PostgreSQL e armazenamento:

```sh
pnpm contas:teste
pnpm dev
```

Com a API ativa, em outro terminal na raiz:

```sh
pnpm demonstracao:completa
```

O comando cria os cenários ausentes pelas rotas normais e preserva o progresso existente. Não reinicia cadastro concluído, convite revogado ou projeto alterado. O projeto principal e o grupo de isolamento preparados no pacote fornecido não são recriados por esse comando. Contas e cenários são descritos no [README](../README.md#contas-de-teste) e no [manual](manual-de-uso.md).

Para uma demonstração nova sem serviços externos, use `pnpm demo`. O terminal informa a pasta e o `environment.sh` que permitem retomá-la com os mesmos dados.

## Importar uma instalação anterior

Este procedimento é para instalações que ainda utilizavam arquivos JSON; **não é necessário no ambiente fornecido já migrado**.

1. Pare a API antiga para impedir gravações durante a cópia.
2. Faça um backup PostgreSQL e preserve os objetos R2 e os arquivos locais antigos.
3. Com o `.env` original na raiz, execute:

```sh
pnpm db:deploy
pnpm db:importar-json
pnpm dev
```

A importação lê `PROJECT_DATA_FILE` e os caminhos antigos de critérios, avaliações e resultados; sem configuração, usa `.data/projects-google.json` e seus arquivos associados. Os dados são validados antes da gravação. Cópias privadas ficam em `.data/backup-migracao-postgresql/`, e os originais são preservados. O banco recebe os quatro agregados e o contador do bucket configurado. Estado divergente já existente provoca erro e rollback; repetir a mesma origem não reverte alterações posteriores. Não execute a versão antiga da API depois da migração.

## Backup e restauração

1. Interrompa alterações e uploads no ambiente durante a cópia.
2. Faça um dump PostgreSQL completo, incluindo `academic_state`, `academic_data_import`, `r2_usage`, identidades, vínculos, convidados e sessões.
3. Copie os objetos R2 preservando suas chaves. Os bytes não estão no dump SQL.
4. Guarde o `.env` separadamente com acesso restrito. Não publique configuração, dumps ou dados privados no Git.

Um ambiente Google migrado não precisa de `.data/projects-google.json` ou outros JSON locais para funcionar. Os arquivos antigos são somente backups de migração. No demo isolado, conserve a pasta temporária indicada no terminal se quiser retomar seus dados; esse modo continua independente do banco de avaliação.

Para restaurar, utilize um banco vazio próprio e os objetos correspondentes. Antes de liberar uploads e reprodução no R2, concilie o contador do banco com o consumo atual; nunca restaure valores antigos para liberar cota. Confira login, materiais, versões, vídeo, feedback, avaliações e resultados antes de retomar escritas.

O dump SQL e a pasta `backup-r2` do pacote privado são cópias de segurança. Não são servidos diretamente pela aplicação e não devem ser aplicados sobre o banco compartilhado de avaliação.

## Verificação

Os comandos de build, testes e dependências do navegador estão no [README](../README.md#testes). `pnpm db:test` utiliza bancos descartáveis e precisa de uma `TEST_DATABASE_URL` própria com permissão `CREATEDB`.
