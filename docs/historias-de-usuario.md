# Histórias de usuário

Requisitos do fluxo acadêmico implementado. As histórias descrevem os objetivos de cada perfil e os comportamentos esperados.

## Autenticar usuários e controlar permissões

**Como usuário, eu gostaria de entrar com minhas credenciais, de forma que possa acessar as funções permitidas ao meu perfil.**

**Critérios de aceitação:**

- Login válido abre a área do perfil; credenciais inválidas exibem erro sem revelar dados.
- Logout invalida a sessão.
- Aluno acessa apenas seu grupo; avaliador apenas projetos atribuídos; professor gerencia sua turma.
- A API rejeita acesso indevido mesmo quando a URL é acessada diretamente.

## Cadastrar grupos e projetos

**Como professor, eu gostaria de cadastrar grupos, integrantes e projetos da turma, de forma que possa organizar as entregas.**

**Critérios de aceitação:**

- Projeto tem título, descrição, turma, ano e categoria.
- Professor vincula integrantes e avaliadores à turma/projeto.
- Aluno vê somente projetos do próprio grupo na área de entrega.
- Alterações de vínculos preservam o histórico.

## Configurar requisitos e critérios de avaliação

**Como professor, eu gostaria de definir materiais obrigatórios, prazo e rubrica, de forma que possa padronizar a entrega e a avaliação.**

**Critérios de aceitação:**

- Vídeo, relatório e manual são requisitos obrigatórios iniciais.
- Cada requisito possui formatos, tamanho máximo e prazo definidos.
- Rubrica define critérios, escala de 0 a 10 e pesos positivos cuja soma é 100%.
- Mudanças após início de avaliações exigem nova versão explícita; avaliações preservam a rubrica utilizada.

## Enviar e substituir materiais

**Como aluno, eu gostaria de enviar vídeo, relatório e manual do projeto, de forma que possa cumprir os requisitos de entrega.**

**Critérios de aceitação:**

- Arquivos válidos são persistidos e vinculados ao projeto; nenhum acesso público é criado na etapa de rascunho.
- Formato e tamanho são validados no servidor; falhas exibem mensagem e permitem tentar novamente.
- Tela mostra progresso, data, autor e versão; substituição mantém histórico.
- Envio é permitido somente ao próprio grupo, enquanto a entrega está aberta.

## Concluir a entrega do projeto

**Como aluno, eu gostaria de verificar pendências e submeter o projeto, de forma que possa encaminhar uma entrega completa para avaliação.**

**Critérios de aceitação:**

- Checklist mostra os materiais obrigatórios presentes e ausentes.
- Submissão incompleta ou fora do prazo é bloqueada, salvo reabertura explícita pelo professor.
- Submissão registra data e snapshot dos materiais e muda estado para Em avaliação.
- Materiais submetidos ficam bloqueados; devolução para ajustes cria nova rodada e preserva a anterior.

## Acompanhar projetos em andamento

**Como avaliador, eu gostaria de visualizar projetos atribuídos ainda em preparação, de forma que possa orientar os grupos antes da entrega.**

**Critérios de aceitação:**

- Lista filtra por grupo, estado e pendências.
- Detalhe permite visualizar materiais autorizados e versões.
- Projetos não atribuídos ficam inacessíveis ao avaliador.
- Nenhuma nota ou comentário privado aparece na galeria pública.

## Trocar feedback no projeto

**Como aluno ou avaliador, eu gostaria de trocar mensagens no projeto, de forma que possa esclarecer dúvidas e orientar melhorias.**

**Critérios de aceitação:**

- Somente integrantes do grupo e equipe docente autorizada podem ler e enviar mensagens.
- Mensagens persistem com autor, data e contexto da versão do material.
- Atualizar ou reabrir a página conserva a conversa em ordem cronológica.
- Erros de envio são indicados sem duplicar mensagens; conteúdo é escapado para prevenir scripts.
- MVP usa comentários com atualização manual, sem exigir chat em tempo real.

## Avaliar projetos por rubrica

**Como avaliador, eu gostaria de registrar notas e comentários por critério, de forma que possa avaliar os projetos de maneira consistente.**

**Critérios de aceitação:**

- Avaliador autorizado vê o snapshot submetido e a rubrica correspondente.
- Notas fora da escala são rejeitadas; rascunho e avaliação final são diferenciados.
- Finalização exige todos os critérios; registra autor, data e rodada.
- Professor pode reabrir avaliação com justificativa; o histórico permanece auditável.

## Consolidar notas dos grupos

**Como professor, eu gostaria de consultar a consolidação das avaliações, de forma que possa acompanhar os resultados e identificar pendências.**

**Critérios de aceitação:**

- Tabela exibe grupo, avaliadores previstos, recebidos, nota e situação.
- Nota por avaliador = soma(nota do critério × peso/100); nota final = média das avaliações finalizadas previstas.
- Avaliações ausentes não contam como zero; resultado parcial é identificado e nota final só existe com todas concluídas.
- Cálculo preserva precisão interna e arredonda apenas exibição a duas casas; exportação CSV corresponde à tabela.
- Somente professor da turma ou ADMIN autorizado acessa a consolidação completa; a prévia acadêmica segue os vínculos próprios.

## Consultar resultado do próprio grupo

**Como aluno, eu gostaria de consultar notas liberadas e comentários da avaliação, de forma que possa entender o resultado do projeto.**

**Critérios de aceitação:**

- Professor libera explicitamente os resultados da rodada.
- Integrantes veem apenas o resultado de seu grupo.
- Rubrica, notas por critério e comentários liberados são exibidos.
- Resultados ainda não liberados mostram estado pendente.

## Finalizar e publicar projetos

**Como professor, eu gostaria de finalizar e publicar um projeto aprovado para divulgação, de forma que possa disponibilizar seu conteúdo no acervo.**

**Critérios de aceitação:**

- Finalização exige materiais completos e avaliações concluídas; registra responsável e data.
- Publicação é ação explícita posterior à finalização; projeto finalizado não é automaticamente público.
- Professor seleciona os materiais autorizados para divulgação e registra autorização do grupo.
- Somente metadados e materiais autorizados tornam-se públicos; notas e feedback continuam privados.
- Professor pode retirar publicação preservando conteúdo e histórico privados.

## Explorar projetos publicados

**Como visitante ou usuário, eu gostaria de buscar e visualizar projetos publicados, de forma que possa conhecer os trabalhos concluídos.**

**Critérios de aceitação:**

- Galeria mostra apenas projetos Publicados.
- Busca por título e filtros por ano, turma e categoria podem ser combinados.
- Detalhe permite assistir ao vídeo e acessar relatório/manual autorizados.
- Projeto despublicado deixa de aparecer e seu acesso público direto é bloqueado.
- Galeria e detalhes funcionam em computadores e smartphones.
