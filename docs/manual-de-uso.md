# Manual de uso e roteiro de demonstração

Roteiro revisado em 26/11/2026 após integração da main e das contas de desenvolvimento. Use a [instalação](instalacao-e-aceitacao.md) antes deste roteiro. Publicação, cadastro USP, convidados, R2 e player privado estão conectados à aplicação. Para as contas `@labrary.test` deste ambiente, consulte diretamente a [demonstração completa com PostgreSQL e R2](#demonstração-completa-com-postgresql-e-r2).

## Entrar e navegar

1. Execute `pnpm demo` e abra `http://localhost:5173`. A página inicial apresenta a plataforma; o acesso fica em `/login`.
2. Entre com uma das três contas locais do [README](../README.md#5-instalação-e-execução). A senha é `Labrary@2026`.
3. Use **Projetos**, **Meu perfil** e, quando permitido, **Minhas turmas** e **Consolidação de notas**. O quadro organiza os projetos por estado, com busca e filtros.
4. Para trocar de perfil da demonstração, use **Sair da conta** e faça outro login. Atualizar a página conserva a sessão enquanto ela for válida; sair revoga a sessão.

No modo Google, use seu e-mail `@usp.br`; contas externas exigem convite prévio do ADMIN. A conta nova recebe ALUNO, sem vínculo automático. Antes da área acadêmica, o aluno USP confirma nome completo, NUSP e ano de ingresso; o professor/ADMIN cadastra os vínculos separadamente. Convidados ficam dispensados dos campos acadêmicos. Os dados aparecem em **Meu perfil**. Login bem-sucedido sem projetos pode significar ausência de vínculo, não falha de autenticação.

Para usar contas fictícias no ambiente Google/PostgreSQL/R2, siga o [provisionamento de desenvolvimento](login-google.md#contas-fictícias-com-senha-no-desenvolvimento-googler2). Elas usam os endereços `@labrary.test` no formulário **E-mail da conta de teste**, com seus próprios papéis e vínculos. Os arquivos seguem o provedor do `.env`; os usuários reais continuam no botão **Entrar com Google**.

## Preparar o projeto como professor

1. Entre como `professor@labrary.local`.
2. Em **Minhas turmas**, confira os grupos e integrantes. Cadastre/edite vínculos apenas entre contas já existentes.
3. Em **Projetos**, abra **Monitor de consumo energético**, do Grupo 02 (projeto 2). O aluno local pertence a esse grupo; o avaliador inicialmente está atribuído ao projeto 1, portanto precisa ser atribuído também ao projeto 2.
4. No painel **Avaliadores**, selecione Rafael Costa e salve a atribuição.
5. Na configuração de requisitos/rubrica, defina vídeo, relatório e manual, formatos/tamanhos permitidos e prazo futuro. Salve critérios com pesos somando 100%; para o exemplo, Funcionamento 60% e Documentação 40%, notas de 0 a 10.
6. Para demonstrar cadastro de projeto novo, use um grupo sem projeto pelo botão **Novo projeto**. Não crie outro projeto para o Grupo 02, que já possui o projeto do roteiro.

## Enviar e submeter como aluno

1. Saia e entre como `aluno@labrary.local`; abra o projeto do Grupo 02.
2. Envie vídeo WebM/MP4 permitido pela rubrica, relatório PDF e manual PDF. O vídeo de teste `e2e/fixtures/demonstracao.webm` pode ser usado na demonstração; prepare PDFs válidos para os outros dois materiais.
3. Confira o progresso e o histórico; substituir um material cria nova versão sem apagar a anterior. O player privado mostra o vídeo atual e começa a carregar ao apertar Play. É possível pausar/avançar, baixar e tentar reproduzir novamente em caso de erro. Não é necessário publicar o projeto para assistir.
4. Use o feedback para registrar uma mensagem e, quando necessário, vinculá-la à versão do material.
5. No painel **Entrega para avaliação**, confira os três obrigatórios e confirme a submissão. O estado passa para **Em avaliação** e os uploads ficam bloqueados. O snapshot conserva a rubrica e as versões exatas.

Se o prazo vencer antes da primeira entrega, a submissão fica bloqueada. O professor pode usar **Reabrir entrega**, com justificativa, para permitir os ajustes. Não é necessário alterar o prazo de toda a turma.

## Avaliar e liberar o resultado

1. Entre como `avaliador@labrary.local` e abra o projeto atribuído. Use **Avaliações por rubrica** para consultar a rodada e baixar seus materiais.
2. Salve uma nota parcial como rascunho e recarregue para conferir a persistência. Preencha todos os critérios e finalize; no exemplo, Funcionamento 8 e Documentação 9.
3. Como professor, abra **Consolidação de notas**. A média ponderada esperada é **8,40**. Exporte CSV e confirme **Liberar resultado** do Grupo 02.
4. Como aluno, consulte **Resultado do grupo**. Antes da liberação, notas e comentários devem ficar bloqueados; após a ação docente, o resultado autorizado fica visível apenas ao próprio grupo.
5. Como professor, reabra a avaliação com justificativa. Confira o histórico e o bloqueio do resultado até nova finalização/liberação.
6. Para nova rodada de entrega, devolva a submissão para ajustes; como aluno, substitua o manual e submeta novamente. A rodada anterior continua consultável. O [roteiro HU08](hu08.md) detalha esse percurso.

## Acervo e publicação

`/acervo` é a interface pública, com filtros e detalhe de materiais autorizados. O servidor normal fornece os repositórios persistentes e `createApp` compõe os produtores reais de submissão C1 e consolidação C3.

1. Após concluir as avaliações da rodada vigente, o professor usa **Finalização e publicação** no projeto e confirma a finalização. A versão finalizada continua privada.
2. Selecione os materiais da rodada finalizada, confirme a autorização do grupo e informe a referência da ata/declaração; só então publique. Liberar notas ao grupo é uma ação independente e não publica o conteúdo.
3. Como visitante, abra `/acervo`, filtre o projeto e confira vídeo/documentos autorizados. Notas, feedback e dados acadêmicos não são divulgados.
4. Como professor, retire a publicação. Novas consultas, downloads, HEAD e Range públicos são bloqueados; os arquivos e o histórico privados são preservados.

O E2E `e2e/publication-flow.spec.ts` usa o entrypoint normal com produtores reais. Os testes isolados `e2e/publication.spec.ts` e as [evidências de Dan](dan-semana7.md) identificam separadamente as fixtures; essas gravações anteriores não comprovam, sozinhas, o aceite da integração atual.

## Administração de contas

A demonstração padrão não fornece ADMIN. No modo Google, um administrador real precisa ser provisionado conforme o [guia de acesso](login-google.md#administradores). A área `/administracao` permite buscar contas e alterar papéis, preservando o último ADMIN ativo. **Visualizar como** muda o perfil efetivo da própria sessão e utiliza seus vínculos; não impersona outro usuário.

ADMIN também usa **Convidados externos** para autorizar o e-mail Google antes do primeiro login e revogar a autorização. Não há envio automático de convite por e-mail. O convite não concede outro papel ou vínculo; revogar bloqueia as sessões e os próximos logins, conservando histórico.

## Erros e recuperação

| Situação | Próximo passo |
| --- | --- |
| Credenciais inválidas | Conferir conta; a API não revela se o e-mail existe |
| Sessão expirada | Entrar novamente; o acesso privado exige sessão válida |
| Projeto ausente/404 | Conferir vínculo com grupo, turma ou atribuição de avaliador |
| Upload recusado | Conferir formato real, extensão, tamanho, prazo e estado da entrega |
| Rubrica ausente/checklist incompleto | Professor configura a rubrica; aluno envia os obrigatórios |
| Conflito de revisão da avaliação | Recarregar os dados antes de reenviar |
| Finalização/publicação bloqueada | Conferir a rodada, rubrica, materiais e avaliações concluídas; falha de integração recebe erro recuperável |

## Persistência e encerramento

Pare com Ctrl+C. Para retomar a mesma demonstração, carregue o `environment.sh` exibido pelo script e execute `pnpm dev`. Rodar `pnpm demo` novamente cria outro diretório. Os dados temporários não constituem backup; copie o conjunto de JSON/uploads e PostgreSQL quando utilizado conforme a [instrução de restauração](instalacao-e-aceitacao.md#backup-e-restauração-de-teste).

## Arquivos no disco e no R2

`pnpm dev` usa o `.env`: com `STORAGE_PROVIDER=r2`, os materiais ficam no bucket privado, enquanto o domínio acadêmico continua em JSON e as identidades Google no PostgreSQL. O servidor usa temporários limitados durante o envio e os remove após concluir ou tratar uma falha. Com `disk`, os bytes ficam em `UPLOAD_DIR`. `pnpm demo` força disco em uma pasta temporária `/tmp` e cria dados novos a cada execução.

A migração de provedor não copia os arquivos antigos automaticamente. Não apague originais nem contadores de uso para liberar a franquia. O R2 possui cobrança por excedentes; as cotas conservadoras da aplicação não são garantia contratual de custo zero. [Configuração e limites do R2](arquitetura.md#cloudflare-r2-e-controle-da-franquia-gratuita).

## Demonstração completa com PostgreSQL e R2

No desenvolvimento configurado com Google, `NODE_ENV=development` e `DEV_TEST_LOGIN=true`, use as oito contas `@labrary.test` do [guia de login](login-google.md#contas-fictícias-com-senha-no-desenvolvimento-googler2). A senha inicial é `LabraryTeste@2026`. Elas usam os dados persistentes e o provedor de arquivos do `.env`; não dependem do botão Google para entrar.

```sh
pnpm contas:teste
pnpm dev
# Em outro terminal, na raiz, com a aplicação já em execução:
pnpm demonstracao:completa
```

O último comando cadastra os cenários ausentes pelas rotas normais, com uploads reais, submissões, avaliações, liberação e decisões de publicação. Ele cria avaliação com rascunho, ajustes, resultado liberado, finalizado privado, publicado, retirado e prazo vencido; acrescenta projetos de primeiro acesso e uma turma de prévia ADMIN. Não cria automaticamente o projeto principal anterior nem o grupo de isolamento de `aluno3`. Não troca o estado de projetos já existentes nem reinicia seu progresso. Cria a turma das contas fictícias quando necessário; não altera turmas ou projetos de usuários reais. Os endereços dos projetos ficam em `.data/demonstracao-completa.json` e aparecem no terminal. Com `STORAGE_PROVIDER=r2`, os arquivos usam o bucket privado. O vídeo padrão é pequeno; `DEMO_VIDEO_FILE` pode indicar outro WebM local permitido pelas cotas.

| Funcionalidade | Conta e cenário |
| --- | --- |
| Enviar/substituir arquivos, imagem, player e feedback | `aluno` e `aluno2`: **Em ajustes — demonstração completa** permite nova versão e material complementar. O projeto principal em preparação, quando já provisionado no ambiente, também pode ser usado |
| Submeter e bloquear uploads | `aluno`: submeta a próxima rodada de **Em ajustes — demonstração completa**, ou use o projeto principal já provisionado |
| Rascunho e finalização de avaliação | `avaliador`: **Em avaliação — demonstração completa**, já atribuído e com rascunho parcial |
| Alterar material e fazer nova rodada | `aluno`: **Em ajustes — demonstração completa**, com submissão anterior devolvida |
| Notas e resultado liberado | `professor`: **Consolidação de notas**; `aluno`: **Resultado liberado — demonstração completa**, média 9,30 |
| Reabrir avaliação e conferir bloqueio do resultado | `professor`: projeto com resultado liberado; a ação preserva o histórico |
| Finalizado ainda privado | `professor`: **Finalizado privado — demonstração completa**, pronto para autorizar/publicar; ainda fora do acervo |
| Acervo público, vídeo e documentos autorizados | Visitante, sem login: **Publicado no acervo — demonstração completa**; manual, notas e mensagens continuam privados |
| Retirada e histórico | `professor`: **Publicação retirada — demonstração completa**; o histórico conserva finalização/publicação/retirada |
| Prazo vencido e reabertura com justificativa | `professor`: **Prazo vencido — demonstração completa** |
| Criar projeto, editar integrantes, avaliadores e rubrica | `professor`: turma de demonstração; grupo **Criar novo projeto — demonstração**, inicialmente sem projeto |
| Isolamento entre grupos | `aluno3` começa sem vínculos no provisionamento novo e não vê os projetos de `aluno`/`aluno2`. Para demonstrar um projeto próprio, o professor cria outro grupo, vincula `aluno3` e cria seu projeto; neste ambiente esse grupo já foi preparado |
| Administração de papéis e convidados | `admin`: **Administrar usuários**; alterações de papéis são reais, inclusive nas contas de teste |
| Visualizar como sem listas vazias | `admin`: **Prévia dos três perfis — administrador**, com vínculos próprios de aluno, avaliador e professor em uma turma separada |
| Primeiro cadastro, validação e Meu perfil | `cadastro`: nome completo, NUSP fictício (ex.: `99000022`) e ingresso; a área acadêmica exige concluir o cadastro |
| Acesso de convidado e revogação | `convidado`: projeto próprio, sem NUSP; o ADMIN revoga/autoriza novamente o convite pelo endereço completo |

Nos endereços acima, acrescente `@labrary.test` ao nome da conta. Para trocar, use **Sair da conta**. Os projetos preparados são exemplos independentes: você pode começar em Ajustes, abrir diretamente uma etapa ou preparar um projeto novo em Preparação. Para o último caso, o professor usa o grupo inicialmente vazio, vincula os alunos, cria o projeto e define requisitos/rubrica antes dos uploads. Alterações permanecem após reiniciar; repetir a preparação preserva esse progresso.

O vídeo de 12 segundos, o relatório com duas versões e a imagem do projeto principal, assim como o grupo de isolamento, foram preparados neste ambiente e ficam em dados privados. Eles não acompanham o clone nem são recriados por `pnpm demonstracao:completa`. O script usa por padrão o pequeno WebM versionado em `e2e/fixtures` e gera PDFs; para outra apresentação, informe `DEMO_VIDEO_FILE` ou envie seus próprios arquivos pela interface. Use os títulos e o arquivo de saída para encontrar projetos: os IDs variam conforme os dados já existentes.

Depois de concluir o primeiro cadastro, a conta `cadastro@labrary.test` passa a entrar normalmente, sem repetir o formulário. O seed não apaga os dados preenchidos. Revogar o convite de `convidado@labrary.test` bloqueia as sessões e a senha até uma nova autorização; repetir o seed não desfaz a revogação. Desligar `DEV_TEST_LOGIN` bloqueia todas as oito contas.

A entrada no Google, a checagem real de `@usp.br` e o consentimento OAuth exigem uma conta Google real. O cadastro fictício e o convidado por senha exercitam as telas, regras e persistência da aplicação; não comprovam autenticação Google nem vínculo com a USP.
