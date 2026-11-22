# Manual do usuário — Labrary Digital

Guia dos fluxos implementados. Preparação do ambiente em [instalação](instalacao-e-aceitacao.md), comandos de verificação na [validação da entrega](../README.md#validação-da-entrega) e pendências em [limitações](limitacoes.md).

## Iniciar localmente

Na raiz do repositório, use Node **24.19.0** e pnpm **11.25.0**:

```sh
pnpm install --frozen-lockfile
pnpm demo
```

Abra <http://localhost:5173>. O script cria dados de demonstração isolados e informa um `environment.sh` para reutilizá-los. Nova execução de `pnpm demo` começa outro ambiente. Para reiniciar com os mesmos arquivos, encerre com Ctrl+C e execute `source /caminho/informado/environment.sh && pnpm dev`. Login local precisa ser repetido após reiniciar. Instalação, banco Google e backup: [guia de instalação](instalacao-e-aceitacao.md).

| Conta de demonstração | Uso |
| --- | --- |
| `professor@labrary.local` | Turma 1, grupos, rubricas, resultados e publicação |
| `aluno@labrary.local` | Grupo 02, projeto 2 |
| `avaliador@labrary.local` | Inicialmente atribuído ao projeto 1; atribua também ao projeto 2 para o roteiro completo |

Senha comum: `Labrary@2026`. Essas contas são exclusivas do modo local de demonstração. A configuração Google usa contas e vínculos próprios; primeiro login não atribui turma automaticamente.

## Professor: preparar a entrega

1. Entre, abra **Minhas turmas** e confira grupos, integrantes e projetos. Para uma demonstração desde o início, abra em **Projetos** o trabalho do **Grupo 02**, em preparação.
2. No detalhe, atribua Rafael Costa como avaliador. Um avaliador removido perde o acesso na próxima requisição.
3. Abra **Requisitos e rubrica** → **Criar nova versão da rubrica**. Defina formatos, tamanhos e prazos futuros para vídeo, relatório e manual. Preencha critérios com pesos positivos somando 100% e salve.
4. Alterações criam outra versão; uma entrega já submetida conserva a configuração anterior. Se a entrega estiver em preparação com prazo vencido, use a reabertura docente e informe a justificativa. Não é possível reabrir uma rodada já finalizada pela HU11.

## Aluno: enviar, substituir e submeter

1. Entre como aluno do Grupo 02 e abra seu projeto. Envie os três materiais pelos campos de arquivo; o sistema valida o conteúdo, o formato e o tamanho. Para vídeo de demonstração, use `e2e/fixtures/demonstracao.webm`; use PDFs próprios de teste para os documentos.
2. Para corrigir um material, envie uma nova versão. O histórico anterior e os comentários ligados a ele continuam disponíveis.
3. Em **Entrega para avaliação**, confira os três requisitos prontos e confirme **Submeter para avaliação**. A rodada congela versões e rubrica; novos envios ficam bloqueados durante a avaliação.
4. Se o professor devolver a entrega para ajustes, corrija os materiais e submeta novamente. A nova rodada não herda notas da anterior.

## Grupo e equipe: feedback privado

Abra a conversa do projeto, escreva a mensagem e, se necessário, vincule-a a uma versão de material. Use a atualização da conversa para buscar novas mensagens. O grupo, os avaliadores atribuídos e o docente autorizado leem a conversa. Publicar um projeto não publica essa conversa.

## Avaliador: registrar notas

Abra um projeto atribuído → **Avaliações por rubrica**. Selecione a rodada e confira a rubrica e os arquivos congelados. **Salvar rascunho** aceita preenchimento parcial. **Finalizar avaliação** exige nota de 0 a 10 para todos os critérios. Uma avaliação finalizada só pode ser alterada após reabertura pelo professor; cada alteração conserva histórico. O avaliador não vê o parecer de outro avaliador. [Roteiro detalhado HU08](hu08.md).

## Professor e aluno: consolidar e consultar resultado

No perfil docente, abra **Consolidação de notas**. Confira previstos, recebidos e pendentes e exporte o CSV. A média final depende de todos os avaliadores previstos concluídos. **Liberar resultado** é uma confirmação separada; até ela, o aluno vê o resultado bloqueado. Reabertura de avaliação ou mudança de rodada exige nova conclusão e liberação.

No perfil do aluno, **Resultado do grupo** exibe apenas o resultado do próprio grupo quando liberado. Liberação de notas e publicação de materiais são decisões independentes.

## Professor: finalizar, publicar e retirar

1. Com a entrega completa e todas as avaliações da rodada concluídas, abra o projeto. Em **Finalização e publicação**, marque **Confirmo a finalização desta rodada** e clique em **Finalizar projeto**. Se a prontidão tiver mudado, recarregue e verifique a causa informada.
2. O projeto finalizado continua privado. A finalização bloqueia alterações da rodada; não precisa liberar o resultado ao aluno para publicar.
3. Obtenha a autorização do grupo fora do sistema. Selecione **somente** as versões autorizadas, confirme a autorização e informe uma referência verificável da declaração/ata. Clique em **Publicar no acervo**. O registro é uma confirmação docente; o sistema não coleta assinatura eletrônica nem presume consentimento.
4. Abra o link do acervo para conferir a seleção. Materiais desmarcados, notas, rubrica e feedback permanecem privados.
5. Para suspender a divulgação, marque **Confirmo a retirada do acervo** e clique em **Retirar publicação**. URLs públicas copiadas passam a ser recusadas nas novas requisições; arquivos e histórico privados permanecem.
6. Para alterar a seleção de uma publicação ativa, retire-a primeiro e publique novamente com a seleção e autorização correspondentes. O projeto permanece finalizado; republicar revalida entrega e avaliações.

## Visitante: consultar o acervo

Acesse `/acervo` sem fazer login. Combine busca por título e filtros de ano, turma e categoria. Abra um projeto para reproduzir o vídeo e baixar os documentos selecionados pelo professor. A ausência de um material no acervo não indica ausência na entrega: ele pode não ter sido autorizado. Se o projeto for retirado, seu link exibe **Publicação não encontrada**.

## Resolver impedimentos comuns

| Mensagem ou situação | Como proceder |
| --- | --- |
| Sessão expirada | Entre novamente; não tente alterar o papel pelo navegador |
| Material incompleto, formato ou tamanho recusado | Confira requisitos/rubrica e envie arquivo válido dentro do limite |
| Entrega fechada ou prazo vencido | Consulte o professor; ajustes/reabertura exigem a ação docente pertinente |
| Finalização sem prontidão | Verifique a última rodada, todos os avaliadores atribuídos e a existência dos arquivos; recarregue após corrigir |
| Rodada/vínculos mudaram | Recarregue os dados e confirme a versão atual antes de repetir a ação |
| Integração indisponível | Verifique a configuração/armazenamento; não há liberação automática por erro de serviço |
| Projeto/publicação não encontrado | Confira o vínculo ou se a publicação foi retirada; não compartilhe URLs privadas como alternativa |
| Nenhum projeto publicado | Conclua uma publicação explícita; finalizar ou liberar nota não alimenta o acervo |

Para executar a demonstração automatizada com gravação do fluxo real de publicação, use `pnpm demo:publicacao`. O vídeo local fica em `test-results/publication/`; é uma execução automatizada com contas de teste, a ser revisada antes da apresentação. [Roteiro e falas da apresentação](apresentacao-final.md).
