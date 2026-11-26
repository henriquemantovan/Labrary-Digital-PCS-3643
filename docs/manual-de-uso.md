# Manual de uso

Siga a [instalação no README](../README.md#instalação-no-ubuntu-2604) e abra **http://localhost:5173/login**. As contas e senhas de demonstração estão no [README](../README.md#contas-de-teste).

## Acesso e permissões

| Perfil | Permissões |
| --- | --- |
| Aluno | Acessar projetos dos próprios grupos; enviar e substituir materiais nos estados permitidos; conversar com a equipe; submeter entregas e consultar resultados liberados |
| Avaliador | Consultar materiais e feedback dos projetos atribuídos; salvar rascunhos e finalizar avaliações pelos critérios de avaliação |
| Professor | Gerenciar grupos e projetos de suas turmas; atribuir avaliadores; configurar requisitos, prazos e critérios de avaliação; devolver entregas, reabrir avaliações, consolidar/exportar notas e publicar materiais autorizados |
| Administrador | Gerenciar contas, papéis e convidados; administrar turmas e projetos. **Visualizar como** usa seus próprios vínculos e as permissões do perfil selecionado |
| Visitante | Consultar o acervo e acessar somente materiais de publicações ativas |

O login Google exige e-mail `@usp.br` ou convite prévio do administrador. Alunos USP completam nome, NUSP e ano de ingresso antes da área acadêmica. Convidados não precisam dos campos acadêmicos. Novos usuários começam como aluno, sem turma ou grupo; o professor ou administrador cria os vínculos.

Use **Sair da conta** antes de trocar de usuário. Um projeto não encontrado pode indicar falta de vínculo. As permissões são verificadas pela API, inclusive em URLs acessadas diretamente.

## Organizar a turma

Como professor, abra **Minhas turmas** e cadastre os grupos com integrantes já registrados. Crie os projetos, atribua avaliadores e defina os requisitos de vídeo, relatório e manual. Os critérios de avaliação usam notas de 0 a 10 e pesos cuja soma é 100%.

## Materiais e entrega

1. Como aluno, abra o projeto e envie os materiais exigidos, respeitando formatos, tamanhos e prazo.
2. Confira o histórico de versões e reproduza o vídeo na área privada. Substituir um arquivo conserva a versão anterior.
3. Registre dúvidas pelo feedback; a mensagem pode apontar para uma versão específica.
4. Quando o checklist estiver completo, confirme **Submeter para avaliação**. A rodada conserva as versões dos materiais e dos critérios de avaliação; novos uploads ficam bloqueados.
5. Se o professor devolver para ajustes, altere os materiais necessários e envie uma nova rodada. As anteriores continuam consultáveis.

O professor pode reabrir uma entrega com justificativa quando o prazo ou estado impedir o envio.

## Avaliação e resultado

Como avaliador, abra um projeto atribuído, consulte a rodada e preencha os critérios. É possível salvar rascunho; a finalização exige todos os critérios.

Como professor, abra **Consolidação de notas**, confira pendências e exporte CSV. A nota de cada avaliador é ponderada pelos pesos; o resultado final é a média das avaliações concluídas. **Liberar resultado** permite que o grupo veja sua nota e os comentários. Reabrir uma avaliação oculta o resultado até nova finalização e liberação.

## Publicação no acervo

1. Concluídas as avaliações, o professor finaliza o projeto. Ele continua privado.
2. Selecione os materiais autorizados e registre a referência do consentimento para publicar.
3. Abra `/acervo` sem login e confira o vídeo e os documentos selecionados. Notas, mensagens e dados acadêmicos continuam privados.
4. Para remover o conteúdo público, use a retirada da publicação. Isso preserva arquivos e histórico privados e bloqueia novas consultas e downloads públicos.

Liberar a nota não publica o projeto. A retirada não recolhe arquivos já baixados pelo visitante.

## Contas e convidados

Em **Administrar usuários**, o administrador pode buscar contas e alterar papéis. O sistema preserva o último administrador real ativo.

Em **Convidados externos**, autorize o e-mail Google antes do primeiro acesso. Não há envio automático de convite por e-mail. A revogação bloqueia as sessões e novos logins do convidado; uma nova autorização pode restabelecer o acesso.

## Cenários disponíveis

| Projeto ou conta | Como usar |
| --- | --- |
| Projeto principal ou **Em ajustes — demonstração completa** | Enviar/substituir arquivos, assistir ao vídeo, registrar feedback e submeter |
| **Em avaliação — demonstração completa** | Continuar o rascunho e finalizar a avaliação |
| **Resultado liberado — demonstração completa** | Consultar a média 9,30; conferir CSV e reabertura como professor |
| **Finalizado privado — demonstração completa** | Selecionar materiais e publicar com autorização |
| **Publicado no acervo — demonstração completa** | Consultar vídeo e relatório sem login |
| **Publicação retirada — demonstração completa** | Conferir o histórico privado e a ausência no acervo |
| `cadastro@labrary.test` | Demonstrar primeiro cadastro com dados fictícios |
| `convidado@labrary.test` | Demonstrar autorização, revogação e nova autorização |

Os cenários preservam as alterações feitas. O cadastro preenchido e os projetos modificados não são reiniciados a cada login.

## Problemas durante o uso

| Situação | Ação |
| --- | --- |
| Sessão expirada | Entre novamente |
| Projeto ausente | Confira o grupo, a turma ou a atribuição do avaliador |
| Upload recusado | Verifique formato real do arquivo, tamanho, prazo e estado da entrega |
| Entrega bloqueada | Confira requisitos obrigatórios e critérios de avaliação |
| Avaliação desatualizada | Recarregue os dados antes de salvar |
| Publicação bloqueada | Confira a rodada vigente, os materiais e todas as avaliações |

Pare a aplicação com **Ctrl+C**. Para continuar, execute `pnpm dev` na mesma pasta. O modo `pnpm demo` cria outra demonstração local a cada execução; siga o [guia de backup](instalacao-e-aceitacao.md#backup-e-restauração) para preservar dados.
