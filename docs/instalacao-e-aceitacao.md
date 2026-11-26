# Configuração e backup

Para usar o ambiente fornecido ao professor, siga o [README](../README.md#instalação-no-ubuntu-2604). Este guia reúne os procedimentos adicionais para manter a instalação ou configurar um ambiente próprio.

## Ambiente fornecido

A equipe entrega código e um pacote privado com `.env`, arquivos em `.data/`, dump PostgreSQL e cópia dos objetos R2. O sistema utiliza o PostgreSQL e o R2 remotos; os backups não precisam ser restaurados para iniciar a avaliação.

Extraia os dados uma única vez na raiz do código. Preserve o `.env` recebido e o contador R2. Não execute seed, reset ou `pnpm storage:init` sobre esse ambiente já preparado.

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

## Backup e restauração

1. Pare a única API que escreve nos dados.
2. Copie juntos projetos, vínculos locais quando usados, rubricas, avaliações, liberações e os arquivos enviados.
3. No modo Google, inclua o backup PostgreSQL de identidades, vínculos, convidados e sessões.
4. No R2, preserve os objetos pelas mesmas chaves e o contador atualizado. No modo disco, preserve `UPLOAD_DIR`.
5. Guarde o `.env` separadamente com acesso restrito. Não publique configuração, dumps ou dados privados no Git.

| Configuração | Caminho padrão |
| --- | --- |
| `PROJECT_DATA_FILE` | `.data/projects-google.json` no modo Google |
| `RUBRIC_DATA_FILE` | `${PROJECT_DATA_FILE}.rubrics.json` |
| `EVALUATION_DATA_FILE` | `${PROJECT_DATA_FILE}.evaluations.json` |
| `RESULT_RELEASE_DATA_FILE` | `${PROJECT_DATA_FILE}.results.json` |
| `R2_USAGE_FILE` | `${PROJECT_DATA_FILE}.r2-usage.json` |
| `GROUP_DATA_FILE` | `${PROJECT_DATA_FILE}.groups.json`, apenas no modo local |
| `UPLOAD_DIR` | `.uploads/`, quando `STORAGE_PROVIDER=disk` |

Para restaurar, utilize outro diretório e um banco vazio próprio. Reponha as identidades, vínculos, snapshots e objetos correspondentes. Antes de usar R2, concilie o contador com o consumo atual; nunca restaure valores antigos para liberar cota. Confira login, materiais, versões, vídeo, feedback, avaliações e resultados antes de retomar escritas.

O dump SQL e a pasta `backup-r2` do pacote privado são cópias de segurança. Não são servidos diretamente pela aplicação e não devem ser aplicados sobre o banco compartilhado de avaliação.

## Verificação

Os comandos de build, testes e dependências do navegador estão no [README](../README.md#testes). `pnpm db:test` utiliza bancos descartáveis e precisa de uma `TEST_DATABASE_URL` própria com permissão `CREATEDB`.
