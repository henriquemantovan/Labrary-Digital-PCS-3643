# Labrary Digital — apresentação final

Roteiro preparado por Henrique em 22/11/2026 para #20/#42 e apresentação prevista em 26/11/2026. Os blocos abaixo são os slides e as falas sugeridas; a duração proposta é 10 minutos. A [validação da entrega](../README.md#6-testes-ci-e-evidências) descreve verificações e pendências. A participação/narração dos integrantes e o aceite do professor precisam de confirmação humana.

Abra [apresentacao-final.html](apresentacao-final.html) diretamente no navegador para exibir os slides, sem servidor ou dependência adicional. Use as setas ou os botões para avançar; **Imprimir / PDF** exporta todos os slides em paisagem. Este documento contém as falas, referências e preparação da demonstração.

## Slide 1 — Do envio ao acervo autorizado · 45 s · Henrique

**Problema:** grupos entregam arquivos e recebem avaliações em lugares diferentes; versões e permissões ficam difíceis de acompanhar.

**Entrega:** um fluxo que reúne materiais, feedback, avaliação e divulgação. Um trabalho finalizado só entra no acervo após autorização explícita.

**Fala:** “O Labrary Digital organiza os projetos de sistemas digitais. Vamos mostrar uma entrega real, sua avaliação e a publicação apenas dos materiais autorizados.”

## Slide 2 — Cinco contribuições conectadas · 1 min · equipe

| Integrante | Contribuição demonstrável | Evidência no repositório |
| --- | --- | --- |
| Henrique | Autorização, grupos, finalização, consentimento e retirada | [HU02](hu02.md), [HU11](hu11.md), [fluxo integrado](../e2e/publication-flow.spec.ts) |
| Enzo | Upload privado, versões, checklist e snapshot da submissão | [HU04](hu04.md), [C1](contratos/c1-submissao.md), [submissão E2E](../e2e/submission.spec.ts) |
| Yuhang | Requisitos/rubrica, rascunho, finalização e reabertura da avaliação | [HU08](hu08.md), [avaliação E2E](../e2e/evaluation.spec.ts) |
| Dan | Acompanhamento, feedback, resultado do grupo e catálogo | [API de acompanhamento](api-inicial.md), [HU07](hu07.md), [manual](manual-usuario.md) |
| Kauê | Cálculo, precisão, CSV, liberação e instalação/CI | [C3](contratos/c3-consolidacao.md), [instalação](instalacao-e-aceitacao.md), [cálculo testado](../packages/api/src/services/consolidation.test.ts) |

**Fala:** “As contribuições se encontram por contratos de domínio. O histórico conserva os autores; o código de avaliação de Yuhang foi incorporado para viabilizar a integração desta demonstração.”

## Slide 3 — Arquitetura e segurança · 1 min · Henrique

**Tela:** [diagrama da arquitetura atual](arquitetura.md).

React usa a API Express na mesma origem, com sessão HttpOnly e CSRF nas mutações. A API verifica vínculos em cada operação. C1 congela materiais/rubrica; C2 registra notas por rodada; C3 calcula e libera o resultado; C4 expõe somente os campos e versões autorizados.

**Fala:** “Concluir avaliação, liberar nota e publicar são três decisões diferentes. Os metadados acadêmicos ficam em arquivos privados; os vídeos e documentos usam disco ou bucket R2 privado, conforme a configuração. Google usa PostgreSQL para identidades, vínculos e sessões. A instalação atual exige um único processo escritor.”

## Slide 4 — Entrega, feedback e avaliação · 2 min 15 s · Enzo, Dan e Yuhang

1. No projeto 2 do Grupo 02, o professor atribui o avaliador e configura requisitos e rubrica com prazo futuro.
2. O aluno envia vídeo, relatório e manual, confere o checklist e confirma a submissão.
3. A equipe registra feedback ligado ao projeto/versão. O avaliador abre a rodada congelada, salva um rascunho e finaliza todos os critérios.

**Falas sugeridas:** Enzo explica o snapshot e o bloqueio de novos envios. Dan mostra a conversa privada e o contexto da versão. Yuhang mostra rubrica, preenchimento parcial, validação e histórico.

**Verificação visível:** o acervo ainda não contém o projeto. O conteúdo do aluno não se tornou público por ter sido enviado ou avaliado.

## Slide 5 — Consolidação e resultado · 1 min · Kauê e Dan

Mostre a tabela docente, o número de avaliadores previstos/recebidos e o CSV. No roteiro HU08 com pesos 60%/40% e notas 8/9, o resultado é 8,40. Libere o resultado e confira a visão do aluno. Demonstre que reabertura recolhe o resultado e exige nova liberação.

**Fala:** “Só avaliações finalizadas entram na média; uma nota zero não equivale a uma avaliação ausente. A liberação vale para o conteúdo exato da rodada. Ela não autoriza publicar os arquivos.”

O [roteiro automatizado da publicação](../e2e/publication-flow.spec.ts) usa um critério de 100% com nota 9 e mantém o resultado bloqueado, para demonstrar a independência entre liberação de notas e divulgação. Não misturar os valores de dois roteiros na gravação.

## Slide 6 — Publicação e retirada reais · 2 min 15 s · Henrique e Dan

1. Como professor, finalize a rodada. Mostre que `/acervo/2` continua sem publicação.
2. Selecione vídeo e relatório; deixe o manual desmarcado. Registre a autorização **demonstrativa** do grupo e publique.
3. Saia da conta e abra o acervo como visitante. Reproduza o vídeo e mostre o download do relatório. Manual, nota e conversa continuam privados.
4. Como professor, retire a publicação. Abra novamente o link público e mostre o bloqueio. Consulte o histórico privado com as três decisões e os materiais conservados.

**Fala:** “Usamos o servidor normal e os repositórios reais de submissão, avaliação e consolidação. A retirada bloqueia novas requisições, inclusive URLs copiadas e Range. Ela não apaga os arquivos privados nem recolhe bytes já recebidos.”

Para preparar o vídeo automatizado desse trecho:

```sh
pnpm exec playwright install chromium
pnpm demo:publicacao
```

O WebM fica sob `test-results/publication/`, junto às capturas. O vídeo mostra uma execução automatizada com contas e conteúdo demonstrativos; revisar e narrar antes de usar na apresentação. Ele não representa os cinco vídeos entregues e aprovados pelos autores.

## Slide 7 — Evidência e limites · 1 min · Henrique e Kauê

**Tela:** [comandos de validação e pendências](../README.md#6-testes-ci-e-evidências).

Mostre o build, as suítes com cobertura mínima de 85% por métrica/pacote e o navegador desktop/celular. Destaque a regressão de concorrência: reabrir uma avaliação durante a verificação de arquivos bloqueia a finalização.

**Limites declarados:** um escritor, disco persistente, consentimento docente por referência e mobile emulado. Instalação limpa Ubuntu 26.04, Google real, revisão cruzada, cinco vídeos finais e definição sobre assinaturas exigem registros próprios. HU13–HU14 não foram incluídas nesta entrega.

**Fala:** “A evidência automatizada sustenta o comportamento técnico. Mantemos separado o que ainda depende de validação da equipe e do professor.”

## Preparação e plano de contingência

Antes de apresentar, cada autor deve conferir seu trecho com o [manual](manual-usuario.md), identificar commit/ambiente da gravação e reunir as referências junto ao [roteiro de aceitação](instalacao-e-aceitacao.md#roteiro-e-divisão-de-evidências). Henrique consolida o material; Kauê coordena a aceitação/instalação. Revisar os cinco fluxos até 24/11 e registrar a revisão e retrospectiva até 25/11, conforme alvos do plano #21.

Para demonstração ao vivo, prepare os vínculos e a rubrica antes, confira os três arquivos e mantenha um único ambiente ativo. Se houver falha externa, use a gravação revisada do fluxo real identificando sua versão/ambiente. Não apresente `/demo/acervo` nem servidores com provedores fabricados como substitutos da integração. Se faltar aprovação acadêmica, mostre o [requisitos acadêmicos pendentes](../README.md#1-tema-e-escopo) e apresente os limites como pendências.
