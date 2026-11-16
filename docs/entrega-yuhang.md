# Entrega de Yuhang — Sprint 5, 05–11/11/2026

Escopo desta alteração: somente **#34**, vinculada a HU03/#3 e à preparação de HU08/#8. Base: `c15bf46` da main; branch local `yuhang/semana-5-requisitos-rubricas`. O README foi restaurado integralmente à base. A implementação da avaliação da S6/#39 e a aceitação integrada da S7/#44 não fazem parte deste incremento.

## Implementado para revisão

- Requisitos obrigatórios de vídeo, relatório e manual, com formatos suportados, limites positivos e prazo por material.
- Rubrica com critérios identificáveis, escala fixa 0–10 e pesos positivos cuja soma é 100%.
- Criação explícita de novas versões, conflito em edição concorrente e preservação das versões anteriores.
- Persistência das configurações em arquivo privado, restauração após reinício, rejeição de dados corrompidos e gravação antes de atualizar o estado em memória.
- Integração com projetos, grupos e autorização já existentes na main; somente professor da turma ou administrador autorizado altera a configuração.
- Formulário de requisitos/rubrica no detalhe do projeto e histórico de versões. A configuração afeta formatos, limites e prazos dos uploads reais; a interface atualiza as regras após salvar.
- [C0](contratos/c0-requisitos-rubrica.md) documentado e [C2 proposto](contratos/c2-avaliacao.md) com exemplos de avaliação pendente, finalizada e reaberta, além de validador isolado de notas e completude. C2 não disponibiliza rotas, formulário nem armazenamento de avaliações nesta semana.

Continuidade do trabalho original de Yuhang/Cosmoy (`2bd66ca`) no PR #26. Histórico e branch originais preservados; grupos/vínculos de Henrique reutilizados. Nenhuma issue foi encerrada, nenhum contrato foi anunciado como aprovado pelos consumidores e nenhuma mensagem foi enviada à equipe.

## Persistência e demonstração

O entrypoint usa `RUBRIC_DATA_FILE`, por padrão `${PROJECT_DATA_FILE}.rubrics.json`. A factory `createApp` utiliza memória quando não recebe repositório persistente. Um único processo escritor deve usar cada arquivo. Antes de atualizar/restaurar, pare o escritor e copie projetos, grupos, rubricas e `UPLOAD_DIR` juntos; no modo Google, inclua também o backup PostgreSQL dos vínculos/identidades. Arquivo de rubricas ausente representa estado inicial vazio; arquivo inválido não é apagado nem reinicializado. Nenhuma migration PostgreSQL ou conversão dos materiais antigos foi introduzida.

Para demonstrar, execute `pnpm dev` com a configuração local já documentada pelo projeto. Entre como professor, abra um projeto e clique em **Requisitos e rubrica**. Crie a primeira versão com os três prazos; crie outra versão e confira **Versões anteriores**. Verifique os limites e prazos mostrados nos materiais. Não há botão de avaliação neste incremento.

## Verificação do recorte S5

Executado novamente sobre o recorte S5 com Node 24.19.0 e pnpm 11.25.0, preservando o lockfile:

- `pnpm build`: passou em Ubuntu 24.04.3 / WSL2.
- `pnpm test`: passou em Ubuntu, API **190 testes** (25 arquivos) e web **74 testes** (10 arquivos).
- Cobertura (statements / branches / functions / lines): API **99,64 / 97,73 / 99,39 / 100%**; web **98,72 / 95,52 / 98,54 / 99,42%**. Limite de 85% preservado.
- Testes e build da web também passaram em Windows. Os testes originais da API que dependem de semântica POSIX continuam intactos; a execução completa foi feita em Linux. Ubuntu 26.04 não foi validado.
- `pnpm test:e2e`: **30 testes passaram** em desktop e emulação mobile, incluindo versões de rubrica, recarga, regras de materiais e ausência do botão de avaliação da S6.
- `git diff --check` e comparação do README com HEAD: passaram, sem diferenças no README.

Logs deste recorte ficam na pasta irmã `../entrega-yuhang/s5/`. Resultados e vídeos anteriores, que incluíam S6/S7, não são evidência deste escopo reduzido. Sem mudanças de migrations/adapter PostgreSQL, `pnpm db:test` não se aplica; CI remoto não foi executado.

## Pendências para concluir #34

- Revisão humana da integração com Henrique e confirmação dos contratos C0/C2 com Enzo e Kauê.
- Vincular este commit e as evidências às issues e registrar a revisão humana; publicação do código não representa aceite automático da história.
- A submissão real C1 e o uso da rubrica pela avaliação serão integrados nas etapas posteriores do plano. Não são entregas concluídas nesta S5.
