# Manual de uso e roteiro de demonstração

Base `c2dbb7f`, revisão de 25/11/2026. Use a [instalação](instalacao-e-aceitacao.md) antes deste roteiro. Ele descreve o comportamento implementado e explicita o bloqueio de publicação.

## Entrar e navegar

1. Execute `pnpm demo` e abra `http://localhost:5173`. A página inicial apresenta a plataforma; o acesso fica em `/login`.
2. Entre com uma das três contas locais do [README](../README.md#5-instalação-e-execução). A senha é `Labrary@2026`.
3. Use **Projetos**, **Meu perfil** e, quando permitido, **Minhas turmas** e **Consolidação de notas**. O quadro organiza os projetos por estado, com busca e filtros.
4. Para trocar de perfil da demonstração, use **Sair da conta** e faça outro login. Atualizar a página conserva a sessão enquanto ela for válida; sair revoga a sessão.

No modo Google, escolha **Entrar com Google** após configurar OAuth/banco. A conta nova recebe ALUNO, sem vínculo automático; o professor/ADMIN precisa cadastrar os vínculos. Login bem-sucedido sem projetos pode significar ausência de vínculo, não falha de autenticação.

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
3. Confira o progresso e o histórico; substituir um material cria nova versão sem apagar a anterior.
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

`/acervo` é a interface pública, com filtros e detalhe de materiais autorizados. Na base revisada, `server.ts` ainda não injeta os provedores reais da decisão de publicação. Por isso **finalizar e publicar um novo projeto não funciona no servidor normal**, mesmo após todas as avaliações estarem completas. Não apresente o fixture como implementação integrada.

Os E2E `e2e/publication.spec.ts` comprovam autorização, catálogo, reprodução, downloads, retirada e negação por URL direta com provedores C1/C3 injetados somente no servidor de testes. As [evidências existentes](dan-semana7.md) identificam essa condição. A integração e a aceitação real pertencem à tarefa #42.

## Administração de contas

A demonstração padrão não fornece ADMIN. No modo Google, um administrador real precisa ser provisionado conforme o [guia de acesso](login-google.md#administradores). A área `/administracao` permite buscar contas e alterar papéis, preservando o último ADMIN ativo. **Visualizar como** muda o perfil efetivo da própria sessão e utiliza seus vínculos; não impersona outro usuário.

## Erros e recuperação

| Situação | Próximo passo |
| --- | --- |
| Credenciais inválidas | Conferir conta; a API não revela se o e-mail existe |
| Sessão expirada | Entrar novamente; o acesso privado exige sessão válida |
| Projeto ausente/404 | Conferir vínculo com grupo, turma ou atribuição de avaliador |
| Upload recusado | Conferir formato real, extensão, tamanho, prazo e estado da entrega |
| Rubrica ausente/checklist incompleto | Professor configura a rubrica; aluno envia os obrigatórios |
| Conflito de revisão da avaliação | Recarregar os dados antes de reenviar |
| Finalização/publicação indisponível | Registrar a limitação de integração; não substituir dados por fixtures |

## Persistência e encerramento

Pare com Ctrl+C. Para retomar a mesma demonstração, carregue o `environment.sh` exibido pelo script e execute `pnpm dev`. Rodar `pnpm demo` novamente cria outro diretório. Os dados temporários não constituem backup; copie o conjunto de JSON/uploads e PostgreSQL quando utilizado conforme a [instrução de restauração](instalacao-e-aceitacao.md#backup-e-restauração-de-teste).
