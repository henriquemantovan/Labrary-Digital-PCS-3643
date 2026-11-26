# Histórias de usuário e critérios de aceite

Os critérios abaixo preservam a definição do produto. Os checkboxes e relatos locais foram escritos durante as sprints e não constituem aceite final. O estado consolidado de implementação e as evidências estão na [revisão final](revisao-final.md); a revisão humana continua nas issues de origem. Atualização documental: 25/11/2026, base `c2dbb7f`.


As funcionalidades foram registradas como issues no formato **Como [papel], eu gostaria de [ação], de forma que [benefício]**, com tarefas, critérios de aceitação, responsável proposto, dependências, estimativa e definição de Done.

| Perfil | Acesso |
| --- | --- |
| Visitante | Acervo e materiais publicados |
| Aluno | Materiais e feedback do próprio grupo; resultados liberados |
| Avaliador | Projetos atribuídos, feedback e avaliações |
| Professor | Grupos da turma, requisitos, rubrica, consolidação, liberação e publicação |

### [HU01 — Autenticar usuários e controlar permissões](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/1)

**Como usuário, eu gostaria de entrar com minhas credenciais, de forma que possa acessar as funções permitidas ao meu perfil.**

- Prioridade P0; sprint sugerida 2; 5 pontos; responsável @henriquemantovan.
- Dependências: nenhuma.

**Critérios de aceitação:**

- [x] Login válido abre a área do perfil; credenciais inválidas exibem erro sem revelar dados.
- [x] Logout invalida a sessão.
- [x] Aluno acessa apenas seu grupo; avaliador apenas projetos atribuídos; professor gerencia sua turma.
- [x] A API rejeita acesso indevido mesmo quando a URL é acessada diretamente.

**Situação atual:** consulte a [revisão final](revisao-final.md#estado-funcional) para implementação, integração e aceite; os critérios abaixo continuam vinculados às issues.

### [HU02 — Cadastrar grupos e projetos](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/2)

**Como professor, eu gostaria de cadastrar grupos, integrantes e projetos da turma, de forma que possa organizar as entregas.**

- Prioridade P0; sprint sugerida 3; continuidade na S5 (#32); 5 pontos; responsável @henriquemantovan.
- Dependências: HU01.

**Critérios de aceitação:**

- [x] Projeto tem título, descrição, turma, ano e categoria.
- [x] Professor vincula integrantes e avaliadores à turma/projeto.
- [x] Aluno vê somente projetos do próprio grupo na área de entrega.
- [x] Alterações de vínculos preservam o histórico.

**Situação atual:** consulte a [revisão final](revisao-final.md#estado-funcional) para implementação, integração e aceite; os critérios abaixo continuam vinculados às issues.

### [HU03 — Configurar requisitos e critérios de avaliação](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/3)

**Como professor, eu gostaria de definir materiais obrigatórios, prazo e rubrica, de forma que possa padronizar a entrega e a avaliação.**

- Prioridade P0; sprint sugerida 3; 5 pontos; responsável @yuhangf2333.
- Dependências: HU01.

**Critérios de aceitação:**

- [ ] Vídeo, relatório e manual são requisitos obrigatórios iniciais.
- [ ] Cada requisito possui formatos, tamanho máximo e prazo definidos.
- [ ] Rubrica define critérios, escala de 0 a 10 e pesos positivos cuja soma é 100%.
- [ ] Mudanças após início de avaliações exigem nova versão explícita; avaliações preservam a rubrica utilizada.

### [HU04 — Enviar e substituir materiais](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/4)

**Como aluno, eu gostaria de enviar vídeo, relatório e manual do projeto, de forma que possa cumprir os requisitos de entrega.**

- Prioridade P0; sprint sugerida 3; 8 pontos; responsável @enplo.
- Dependências: HU02,HU03.

**Critérios de aceitação:**

- [x] Arquivos válidos são persistidos e vinculados ao projeto; nenhum acesso público é criado na etapa de rascunho.
- [x] Formato e tamanho são validados no servidor; falhas exibem mensagem e permitem tentar novamente.
- [x] Tela mostra progresso, data, autor e versão; substituição mantém histórico.
- [x] Envio é permitido somente ao próprio grupo, enquanto a entrega está aberta.

**Situação atual:** consulte a [revisão final](revisao-final.md#estado-funcional) para implementação, integração e aceite; os critérios abaixo continuam vinculados às issues.

### [HU05 — Concluir a entrega do projeto](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/5)

**Como aluno, eu gostaria de verificar pendências e submeter o projeto, de forma que possa encaminhar uma entrega completa para avaliação.**

- Prioridade P0; sprint sugerida 4; 5 pontos; responsável @enplo.
- Dependências: HU04.

**Critérios de aceitação:**

- [ ] Checklist mostra os materiais obrigatórios presentes e ausentes.
- [ ] Submissão incompleta ou fora do prazo é bloqueada, salvo reabertura explícita pelo professor.
- [ ] Submissão registra data e snapshot dos materiais e muda estado para Em avaliação.
- [ ] Materiais submetidos ficam bloqueados; devolução para ajustes cria nova rodada e preserva a anterior.

### [HU06 — Acompanhar projetos em andamento](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/6)

**Como avaliador, eu gostaria de visualizar projetos atribuídos ainda em preparação, de forma que possa orientar os grupos antes da entrega.**

- Prioridade P0; sprint sugerida 4; 3 pontos; responsável @kiyochii.
- Dependências: HU01,HU02,HU04.

**Critérios de aceitação:**

- [x] Lista filtra por grupo, estado e pendências.
- [ ] Detalhe permite visualizar materiais autorizados e versões.
- [x] Projetos não atribuídos ficam inacessíveis ao avaliador.
- [ ] Nenhuma nota ou comentário privado aparece na galeria pública.

**Situação atual:** consulte a [revisão final](revisao-final.md#estado-funcional) para implementação, integração e aceite; os critérios abaixo continuam vinculados às issues.

### [HU07 — Trocar feedback no projeto](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/7)

**Como aluno ou avaliador, eu gostaria de trocar mensagens no projeto, de forma que possa esclarecer dúvidas e orientar melhorias.**

- Prioridade P0; sprint sugerida 4; 5 pontos; responsável @kiyochii.
- Dependências: HU06.

**Critérios de aceitação:**

- [x] Somente integrantes do grupo e equipe docente autorizada podem ler e enviar mensagens.
- [x] Mensagens persistem com autor, data e contexto da versão do material.
- [x] Atualizar ou reabrir a página conserva a conversa em ordem cronológica.
- [x] Erros de envio são indicados sem duplicar mensagens; conteúdo é escapado para prevenir scripts.
- [x] MVP usa comentários com atualização manual, sem exigir chat em tempo real.

**Situação atual:** consulte a [revisão final](revisao-final.md#estado-funcional) para implementação, integração e aceite; os critérios abaixo continuam vinculados às issues.

### [HU08 — Avaliar projetos por rubrica](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/8)

**Como avaliador, eu gostaria de registrar notas e comentários por critério, de forma que possa avaliar os projetos de maneira consistente.**

- Prioridade P0; sprint sugerida 5; 8 pontos; responsável @yuhangf2333.
- Dependências: HU03,HU05.

**Critérios de aceitação:**

- [ ] Avaliador autorizado vê o snapshot submetido e a rubrica correspondente.
- [ ] Notas fora da escala são rejeitadas; rascunho e avaliação final são diferenciados.
- [ ] Finalização exige todos os critérios; registra autor, data e rodada.
- [ ] Professor pode reabrir avaliação com justificativa; o histórico permanece auditável.

**Implementação para revisão (#39/#44):** [fluxo de avaliação e consolidação](hu08.md) sobre submissão real, com avaliações persistidas, reabertura auditável e consulta à rubrica de rodadas anteriores.

### [HU09 — Consolidar notas dos grupos](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/9)

**Como professor, eu gostaria de consultar a consolidação das avaliações, de forma que possa acompanhar os resultados e identificar pendências.**

- Prioridade P0; sprint sugerida 5; 5 pontos; responsável @kauebmr.
- Dependências: HU08.

**Critérios de aceitação:**

- [ ] Tabela exibe grupo, avaliadores previstos, recebidos, nota e situação.
- [ ] Nota por avaliador = soma(nota do critério × peso/100); nota final = média das avaliações finalizadas previstas.
- [ ] Avaliações ausentes não contam como zero; resultado parcial é identificado e nota final só existe com todas concluídas.
- [ ] Cálculo preserva precisão interna e arredonda apenas exibição a duas casas; exportação CSV corresponde à tabela.
- [ ] Somente professor da turma acessa a consolidação completa.

### [HU10 — Consultar resultado do próprio grupo](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/10)

**Como aluno, eu gostaria de consultar notas liberadas e comentários da avaliação, de forma que possa entender o resultado do projeto.**

- Prioridade P1; sprint sugerida 5; 3 pontos; responsável @kiyochii.
- Dependências: HU09.

**Critérios de aceitação:**

- [ ] Professor libera explicitamente os resultados da rodada.
- [ ] Integrantes veem apenas o resultado de seu grupo.
- [ ] Rubrica, notas por critério e comentários liberados são exibidos.
- [ ] Resultados ainda não liberados mostram estado pendente.

### [HU11 — Finalizar e publicar projetos](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/11)

**Como professor, eu gostaria de finalizar e publicar um projeto aprovado para divulgação, de forma que possa disponibilizar seu conteúdo no acervo.**

- Prioridade P0; sprint sugerida 6; 5 pontos; responsável @henriquemantovan.
- Dependências: HU09.

**Critérios de aceitação:**

- [ ] Finalização exige materiais completos e avaliações concluídas; registra responsável e data.
- [ ] Publicação é ação explícita posterior à finalização; projeto finalizado não é automaticamente público.
- [ ] Professor seleciona os materiais autorizados para divulgação e registra autorização do grupo.
- [ ] Somente metadados e materiais autorizados tornam-se públicos; notas e feedback continuam privados.
- [ ] Professor pode retirar publicação preservando conteúdo e histórico privados.

**Situação atual:** consulte a [revisão final](revisao-final.md#estado-funcional) para implementação, integração e aceite; os critérios abaixo continuam vinculados às issues.

### [HU12 — Explorar projetos publicados](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/12)

**Incremento S5 (#35):** catálogo/detalhe responsivos, busca e filtros combinados sobre C4, demonstráveis em `/demo/acervo` somente no servidor de desenvolvimento. Cliente HTTP separado, sem fallback de fixtures em produção. Publicação real e aceite permanecem na S6/S7. [Demonstração, regressão HU06 e evidências](catalogo-semana-5.md).

**Como visitante ou usuário, eu gostaria de buscar e visualizar projetos publicados, de forma que possa conhecer os trabalhos concluídos.**

- Prioridade P0; sprint sugerida 6; 5 pontos; responsável @kiyochii.
- Dependências: HU11.

**Critérios de aceitação:**

- [ ] Galeria mostra apenas projetos Publicados.
- [ ] Busca por título e filtros por ano, turma e categoria podem ser combinados.
- [ ] Detalhe permite assistir ao vídeo e acessar relatório/manual autorizados.
- [ ] Projeto despublicado deixa de aparecer e seu acesso público direto é bloqueado.
- [ ] Galeria e detalhes funcionam em computadores e smartphones.

### [HU13 — Consultar histórico de acessos e favoritos](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/13)

**Como usuário autenticado, eu gostaria de salvar favoritos e acompanhar projetos vistos, de forma que possa retomar conteúdos de interesse.**

- Prioridade P2; sprint sugerida 6; 3 pontos; responsável @henriquemantovan.
- Dependências: HU12.

**Critérios de aceitação:**

- [ ] Abrir conteúdo publicado registra acesso e marca como visto no perfil.
- [ ] Usuário pode incluir/remover favoritos e consultar sua lista.
- [ ] Histórico e favoritos são privados e isolados por usuário.
- [ ] Despublicação oculta o conteúdo do catálogo; registro histórico permanece para controle administrativo.

### [HU14 — Ver estatísticas e sugestões de conteúdo](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/14)

**Como professor ou usuário autenticado, eu gostaria de consultar estatísticas ou receber sugestões conforme meu perfil, de forma que possa acompanhar o acervo e descobrir conteúdos relevantes.**

- Prioridade P2; sprint sugerida 6; 5 pontos; responsável @kauebmr.
- Dependências: HU13.

**Critérios de aceitação:**

- [ ] Professor vê acessos por projeto/categoria e quantidade de usuários de sua turma.
- [ ] Usuário recebe sugestões por categorias do histórico; sem histórico, vê projetos publicados recentes.
- [ ] Recomendações excluem conteúdos privados ou despublicados.
- [ ] Estatísticas não expõem histórico individual para outros alunos.

### Definição de concluído compartilhada

- [ ] Todos os critérios de aceitação atendidos.
- [ ] Código ou artefato revisado por outro integrante e aprovado.
- [ ] Testes unitários, integração e/ou sistema pertinentes passam.
- [ ] Cobertura de pelo menos 85% no escopo testável definido e documentado.
- [ ] Permissões, erros e acesso mobile verificados quando aplicáveis.
- [ ] Documentação e backlog atualizados.
- [ ] Incremento demonstrado na revisão da sprint.
