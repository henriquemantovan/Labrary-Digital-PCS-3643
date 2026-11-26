# Manual de uso e roteiro de demonstração

Roteiro integrado após o merge de 25/11/2026. Use a [instalação](instalacao-e-aceitacao.md) antes deste roteiro. Publicação, cadastro USP, convidados, R2 e player privado estão conectados à aplicação.

## Entrar e navegar

1. Execute `pnpm demo` e abra `http://localhost:5173`. A página inicial apresenta a plataforma; o acesso fica em `/login`.
2. Entre com uma das três contas locais do [README](../README.md#5-instalação-e-execução). A senha é `Labrary@2026`.
3. Use **Projetos**, **Meu perfil** e, quando permitido, **Minhas turmas** e **Consolidação de notas**. O quadro organiza os projetos por estado, com busca e filtros.
4. Para trocar de perfil da demonstração, use **Sair da conta** e faça outro login. Atualizar a página conserva a sessão enquanto ela for válida; sair revoga a sessão.

No modo Google, use seu e-mail `@usp.br`; contas externas exigem convite prévio do ADMIN. A conta nova recebe ALUNO, sem vínculo automático. Antes da área acadêmica, o aluno USP confirma nome completo, NUSP e ano de ingresso; o professor/ADMIN cadastra os vínculos separadamente. Convidados ficam dispensados dos campos acadêmicos. Os dados aparecem em **Meu perfil**. Login bem-sucedido sem projetos pode significar ausência de vínculo, não falha de autenticação.

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
