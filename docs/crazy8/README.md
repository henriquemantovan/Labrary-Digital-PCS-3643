# Crazy 8 e validação de protótipos (TEC03)

Registro da tarefa [TEC03 — Validar Crazy 8 e protótipos com o grupo](https://github.com/henriquemantovan/Labrary-Digital-PCS-3643/issues/17).

| Campo | Valor |
| --- | --- |
| Responsável | @enplo |
| Sprint | 2 |
| Data da sessão |  15/10/2026 |
| Participantes | @henriquemantovan, @enplo, @kiyochii, @yuhangf2333, @kauebmr |

## 1. Ideias individuais

Cada integrante dobrou uma folha em 8 partes e desenhou uma ideia de tela em cada parte. As folhas foram fotografadas para deixá-las registradas.

| Imagem | Autor | Ideias registradas | Conteúdo |
| --- | --- | ---: | --- |
| ![](<crazy8 (4).jpeg>) | @yuhangf2333 | 7 | Homepage com vídeo e grupos, submeter trabalho, cadastro, login, avaliar outros grupos, painel do professor, dashboard e métricas |
| ![](<crazy8 (5).jpeg>) | @henriquemantovan | 4 | Destaques (1º/2º/3º), painel do aluno com upload por arrastar, pesquisa, painel de administrador por turma |
| ![](<crazy8 (6).jpeg>) | @kauebmr | 7 | Escolha de perfil, visão do professor com "Avaliar", upload do aluno, tabela de notas, chat de dúvidas, premiados, fotos da feira |
| ![](<crazy8 (7).jpeg>) | @kiyochii | 8 | Busca com categorias, página inicial com vídeo, rodapé, animação, linha do tempo, lista de integrantes, menu lateral, arquitetura |
| ![](<crazy8 (8).jpeg>) | @enplo | 1 | Vídeo, nome do grupo, integrantes e fotos |

> As folhas (4), (5), (6) e (8) têm menos de 8 ideias. O critério de aceitação pede oito por integrante.

## 2. Ideias escolhidas

Pensando em criar uma interface fácil de usar e atrativa visualmente, dentre as 27 ideias registradas nas folhas, foram escolhidas as 3 que mais se adequam aos requisitos do projeto. As ideias escolhidas foram redesenhadas no quadro branco.

### 2.1 Homepage

![](<crazy8 (1).jpeg>)

- **Origem:** folha (4); variação na folha (7).
- **Conteúdo:** barra de busca, banner com nome da plataforma e vídeo, cards "Conheça os grupos de PCS3645" com o vídeo de cada grupo.
- **Justificativa:** Por ser a página inicial do site, ela tem que comunicar da maneira mais clara possível sobre o que é o Labrary Digital. Dessa forma, ao ver diretamente na página inicial um banner apresentando o site de maneira rápida e atrativa, a curva de aprendizado do usuário já é reduzida drasticamente. Além disso, deixa as demonstrações dos projetos a um click de distância do usuário. 

### 2.2 Apresentação do projeto

![](<crazy8 (2).jpeg>)

- **Origem:** folha (6); variações nas folhas (7) e (8).
- **Conteúdo:** lista lateral de projetos finais (Grupo 1…20) e página do projeto com nome, integrantes, vídeo, descrição e materiais (relatório final, apresentação, guia de uso).
- **Justificativa:** A página do projeto é o núcleo de uma biblioteca digital: é nela que o conteúdo produzido pelos grupos é efetivamente consultado. A proposta reúne em um único lugar o vídeo de apresentação, a descrição e os materiais entregues (relatório e manual, os mesmos exigidos na HU04), além de dar crédito aos integrantes. A lista lateral de grupos permite navegar entre projetos sem voltar ao acervo, o que facilita a comparação entre trabalhos. Foi a ideia mais recorrente da sessão, presente nas folhas (6), (7) e (8). Na adaptação, a caixa de avaliações foi removida, já que o grupo decidiu que notas e feedback não ficam públicos.

### 2.3 Linha do tempo

![](<crazy8 (3).jpeg>)

- **Origem:** folha (7).
- **Conteúdo:** linha do tempo vertical com as etapas do projeto, do início à entrega.
- **Justificativa:** A linha do tempo torna visível o andamento de cada projeto, mostrando em que etapa ele está (em preparação, em avaliação, ajustes solicitados, concluído, publicado) e quais prazos se aproximam. Para os alunos, ela reduz dúvidas sobre o que falta entregar. Para professores e avaliadores, oferece uma visão rápida da situação de cada grupo. A ideia apoia diretamente a HU05 (Concluir a entrega do projeto) e a HU06 (Acompanhar projetos em andamento), que dependem de estados e prazos bem definidos, e complementa o checklist de materiais já presente no protótipo de envio.

## 3. Decisões

| Tema | Decisão | Impacto |
| --- | --- | --- |
| Avaliações na página pública | **Não ficam públicas.** Notas e feedback ficam restritos à área privada. | A caixa de avaliações com estrelas do esboço 2.2 sai da página pública. O protótipo `03-detalhe-publico` já segue essa regra. |
| Quem avalia | _Pendente._ O esboço da folha (4) propõe alunos avaliando outros grupos com estrelas; o protótipo `07-avaliacao` usa rubrica com pesos preenchida por avaliador. | Define a HU08. |

## 4. Comparação com os protótipos

Protótipos em [`../prototipos`](../prototipos).

| Protótipo | Ideia correspondente | Situação |
| --- | --- | --- |
| [`01-login`](../prototipos/01-login.svg) | Login (4) | Parcial: faltam cadastro (4) e escolha de perfil (6) |
| [`02-acervo`](../prototipos/02-acervo.svg) | Homepage (2.1) e busca (7) | Equivalente após ajuste: banner com vídeo, vitrine "Conheça os grupos" e filtros por ano, turma e categoria (HU12) |
| [`03-detalhe-publico`](../prototipos/03-detalhe-publico.svg) | Apresentação do projeto (2.2) | Equivalente após ajuste: lista lateral de projetos finais e integrantes; sem avaliações públicas |
| [`04-materiais`](../prototipos/04-materiais.svg) | Submeter trabalho (4), painel do aluno (5), upload (6) | Equivalente |
| [`05-feedback`](../prototipos/05-feedback.svg) | Chat de dúvida (6) | Equivalente |
| [`06-acompanhamento`](../prototipos/06-acompanhamento.svg) | Painel do professor (4), visão do professor (6) | Parcial |
| [`07-avaliacao`](../prototipos/07-avaliacao.svg) | Avaliar outros grupos (4), botão Avaliar (6) | Depende da decisão "Quem avalia" |
| [`08-consolidacao`](../prototipos/08-consolidacao.svg) | Tabela de notas (6) | Equivalente |
| [`09-linha-do-tempo`](../prototipos/09-linha-do-tempo.svg) | Linha do tempo (2.3) | Criado a partir da ideia escolhida: etapas da entrega (HU05/HU06), próximo passo e prazos |

Cada tela tem uma versão mobile (390×844) com o mesmo nome em [`../prototipos/mobile`](../prototipos/mobile). No mobile, o menu do cabeçalho vira um botão ☰, a lista lateral de projetos do detalhe público vira um seletor e os cards ficam em uma coluna.

Ideias dos esboços sem protótipo e fora das escolhidas, para avaliar no backlog: destaques e premiados, dashboard e métricas (relacionado à HU14), fotos da feira, painel de administrador por turma.

## 5. Validação dos protótipos

Teste de navegação com o grupo, em desktop e mobile, observando clareza dos estados, recuperação de erros e acessibilidade.

| Tela | Desktop | Mobile | Observações |
| --- | --- | --- | --- |
| Login | ☐ | ☐ | |
| Acervo | ☐ | ☐ | |
| Detalhe público | ☐ | ☐ | |
| Envio de materiais | ☐ | ☐ | |
| Linha do tempo | ☐ | ☐ | |
| Feedback | ☐ | ☐ | |
| Acompanhamento | ☐ | ☐ | |
| Avaliação | ☐ | ☐ | |
| Consolidação | ☐ | ☐ | |

## 6. Pendências

- [x] Preencher data, participantes e autor de cada folha.
- [ ] Completar as ideias faltantes nas folhas (4), (5), (6) e (8), ou registrar a justificativa.
- [x] Escrever a justificativa de cada ideia escolhida.
- [ ] Decidir quem avalia (alunos ou avaliadores por rubrica).
- [x] Ajustar `02-acervo` e `03-detalhe-publico` conforme as ideias 2.1 e 2.2.
- [x] Criar protótipo da linha do tempo (2.3).
- [x] Criar versões mobile dos protótipos.
- [ ] Executar e registrar a validação da seção 5.
- [ ] Revisão por outro integrante.
