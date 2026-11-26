# Responsabilidades, backlog e sprints

Registro do planejamento das sete sprints. As tabelas e datas abaixo preservam o planejamento e as atualizações históricas; não substituem o estado atual das issues nem demonstram aceite. A [revisão final](revisao-final.md) reúne a situação da integração atual, os responsáveis e as pendências. O quadro da interface do produto organiza projetos acadêmicos; ele não é evidência do kanban de desenvolvimento da equipe.


**Responsabilidade atual do código:** Henrique (HU01/HU02 e publicação), Enzo (materiais/submissão), Yuhang (rubricas/avaliação e redesign), Dan (acompanhamento/feedback/resultados/acervo) e Kauê (consolidação, instalação e CI). HU13–HU14 saíram do escopo; a tabela abaixo preserva a proposta inicial e seus papéis Scrum.

**Divisão proposta**, baseada nas áreas do projeto; habilidades e disponibilidade ainda precisam ser validadas pelos cinco integrantes. Todos participam do desenvolvimento, planejamento, revisão e testes. Papéis de Scrum não excluem a contribuição técnica.

| Integrante | Responsabilidade principal | Papel Scrum proposto | Itens sob responsabilidade |
| --- | --- | --- | --- |
| @henriquemantovan | Integração, arquitetura, acesso e publicação | Product Owner interno: ordenar backlog e levar dúvidas ao professor | HU01, HU11, HU13, TEC02, TEC06 |
| @enplo | Entrega de materiais e validação dos esboços | Developer | HU04, HU05, TEC03 |
| @kiyochii | Interface do acervo, feedback e resultados | Developer | HU06, HU07, HU10, HU12 |
| @yuhangf2333 | Regras de negócio, rubrica, API e CI | Developer | HU02, HU03, HU08, TEC04 |
| @kauebmr | Banco, consolidação e garantia da qualidade | Scrum Master interno e Developer | HU09, HU14, TEC01, TEC05 |

O professor é stakeholder e valida os requisitos acadêmicos; o papel interno de Product Owner não substitui essa validação. Scrum Master facilita eventos e remoção de impedimentos; não distribui unilateralmente tarefas.

**Revisão cruzada proposta:** Henrique ↔ yuhangf2333 nas APIs; enplo ↔ kiyochii nas interfaces; kauebmr revisa cálculo, persistência e testes, com revisão de outro integrante em seus próprios PRs. Compartilhar testes evita concentrar toda a qualidade em uma pessoa.

As responsabilidades estão no corpo das issues. Os convites para @enplo, @kiyochii, @yuhangf2333 e @kauebmr foram enviados e aguardam aceite. Após o aceite, os responsáveis poderão ser definidos no campo Assignees.

## 6. Montagem do backlog

**Acompanhamento central:** [Product Backlog e sprints — issue #21](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/21).

**HU01 — atualização local:** implementação pronta para revisão; critérios técnicos cobertos por testes. A conclusão formal depende da revisão e demonstração da equipe. Ver [registro da HU01](hu01.md). Issues remotas não foram alteradas.

O **Product Backlog** contém todas as histórias e tarefas técnicas. O **Sprint Backlog** contém o recorte que a equipe assume após avaliar capacidade. A coluna de sprint abaixo é uma sugestão de sequenciamento, não um compromisso já assumido.

Prioridades: **P0** essencial ao MVP/entrega técnica; **P1** importante; **P2** complemento condicionado à capacidade e à decisão do professor. Pontos são estimativas relativas iniciais, sem equivalência fixa em horas.

| Item | Entrega | Prioridade | Pontos | Sprint | Responsável proposto | Dependências |
| --- | --- | --- | ---: | ---: | --- | --- |
| [TEC01](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/15) | Modelar e criar o banco de dados | P0 | 5 | 1 | @kauebmr | — |
| [HU01](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/1) | Autenticar usuários e controlar permissões | P0 | 5 | 2 | @henriquemantovan | — |
| [TEC02](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/16) | Preparar ambiente MVC/REST e APIs iniciais | P0 | 5 | 2 | @henriquemantovan | TEC01 |
| [TEC03](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/17) | Validar Crazy 8 e protótipos com o grupo | P0 | 3 | 2 | @enplo | — |
| [TEC04](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/18) | Implementar testes e integração contínua | P0 | 5 | 2 | @yuhangf2333 | TEC02 |
| [HU02](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/2) | Cadastrar grupos e projetos | P0 | 5 | 3 | @yuhangf2333 | HU01 |
| [HU03](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/3) | Configurar requisitos e critérios de avaliação | P0 | 5 | 3 | @yuhangf2333 | HU01 |
| [HU04](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/4) | Enviar e substituir materiais | P0 | 8 | 3 | @enplo | HU02,HU03 |
| [HU05](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/5) | Concluir a entrega do projeto | P0 | 5 | 4 | @enplo | HU04 |
| [HU06](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/6) | Acompanhar projetos em andamento | P0 | 3 | 4 | @kiyochii | HU01,HU02,HU04 |
| [HU07](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/7) | Trocar feedback no projeto | P0 | 5 | 4 | @kiyochii | HU06 |
| [HU08](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/8) | Avaliar projetos por rubrica | P0 | 8 | 5 | @yuhangf2333 | HU03,HU05 |
| [HU09](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/9) | Consolidar notas dos grupos | P0 | 5 | 5 | @kauebmr | HU08 |
| [HU10](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/10) | Consultar resultado do próprio grupo | P1 | 3 | 5 | @kiyochii | HU09 |
| [HU11](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/11) | Finalizar e publicar projetos | P0 | 5 | 6 | @henriquemantovan | HU09 |
| [HU12](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/12) | Explorar projetos publicados | P0 | 5 | 6 | @kiyochii | HU11 |
| [HU13](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/13) | Consultar histórico de acessos e favoritos | P2 | 3 | 6 | @henriquemantovan | HU12 |
| [HU14](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/14) | Ver estatísticas e sugestões de conteúdo | P2 | 5 | 6 | @kauebmr | HU13 |
| [TEC05](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/19) | Validar fluxos pelo navegador e preparar instalação | P0 | 5 | 7 | @kauebmr | HU01,HU04,HU07,HU08,HU09,HU12,TEC04 |
| [TEC06](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/20) | Atualizar documentação e preparar apresentação final | P0 | 3 | 7 | @henriquemantovan | TEC05 |

### Sprints semanais propostas

A aula prevê sete sprints entre 08/10 e 26/11, com apresentação final em 26/11/2026. As janelas abaixo são uma proposta operacional; confirmar as datas de revisão com o professor.

| Sprint | Janela proposta de 2026 | Objetivo | Itens sugeridos |
| --- | --- | --- | --- |
| 1 | 08–14/10 | DER, banco, migrações, script SQL e seed | TEC01 |
| 2 | 15–21/10 | Frontend inicial, APIs, classes, acesso e CI | TEC02, TEC03, HU01, TEC04 |
| 3 | 22–28/10 | Grupos, requisitos e envio versionado | HU02, HU03, HU04 |
| 4 | 29/10–04/11 | Submissão, acompanhamento e feedback; demonstração parcial | HU05, HU06, HU07 |
| 5 | 05–11/11 | Avaliação, consolidação e resultado do grupo | HU08, HU09, HU10 |
| 6 | 12–18/11 | Publicação e acervo; complementos conforme capacidade | HU11, HU12; HU13–HU14 se aprovadas |
| 7 | 19–25/11 | Aceitação, testes web, instalação limpa e apresentação | TEC05, TEC06 e correções |
| Entrega | 26/11 | Apresentação e conteúdo final | Demonstração e repositório atualizado |

Banco, testes, documentação e backlog evoluem em todas as sprints; não são encerrados após sua sprint inicial.

### Fluxo de trabalho e eventos

- **Planejamento semanal:** definir objetivo, selecionar itens prontos e assumir responsáveis.
- **Alinhamento breve:** comunicar progresso, próxima ação e impedimentos.
- **Revisão semanal:** demonstrar incremento e registrar aceite/ajustes.
- **Retrospectiva:** definir uma melhoria concreta do processo.
- **Refinamento:** revisar critérios, dependências e estimativas antes da próxima sprint.
- **Kanban proposto:** Backlog → Pronto → Em andamento → Em revisão → Concluído. Impedimentos são sinalizados e documentados.
- **Pronto:** critérios claros, responsável, estimativa, dependências tratadas e protótipo validado quando aplicável.
- **Concluído:** Definition of Done satisfeita; fechar a issue após aceite, preferencialmente vinculando o PR.

O backlog foi montado nas issues, conforme solicitado. A issue de acompanhamento agrega checklists por sprint e uma visão inicial dos estados. Um quadro GitHub Projects não foi criado; a equipe pode espelhar esse fluxo nele quando disponível.

### Atualização do Kanban — 11/10/2026

| Coluna | Itens | Situação registrada |
| --- | --- | --- |
| Backlog | HU01–HU14, TEC02–TEC06 | Aguardando priorização e capacidade das sprints |
| Em andamento | TEC01 — modelagem e criação do banco | DER e script SQL inicial adicionados; execução em PostgreSQL, revisão do modelo e seed ainda pendentes |
| Em revisão | — | Nenhum item registrado |
| Concluído | — | Nenhum item marcado como concluído sem aceite da equipe |

Essa atualização documenta o estado no repositório e complementa a issue #21; não altera o quadro remoto do GitHub Projects.

### Atualização local — HU06 (02/11/2026)

Acompanhamento de metadados em revisão: filtros por grupo, estado e pendências, detalhe com histórico de versões e acesso restrito às atribuições. A integração atual já inclui arquivos privados (HU04) e catálogo sem notas/feedback (HU11/HU12). Revisão de outro integrante, refinamento e demonstração continuam sujeitos ao aceite humano. Detalhes no [manual de uso](manual-de-uso.md). Este registro não fecha a issue #6 nem altera o backlog remoto #21.

### Atualização local — HU07 (02/11/2026)

Conversa privada implementada para revisão, com persistência local, contexto de versão e atualização manual. Critérios funcionais cobertos por testes; refinamento, revisão e demonstração pendentes. Veja [docs/hu07.md](hu07.md). Esse registro não fecha a issue #7 nem altera o backlog remoto #21.
