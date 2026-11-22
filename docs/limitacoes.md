# Limitações e pendências da entrega

Limites operacionais e pendências acadêmicas da aplicação. Os comandos estão na [validação da entrega](../README.md#validação-da-entrega); aprovação automatizada não equivale a aceite da equipe ou do professor.

| Limite | Consequência e acompanhamento |
| --- | --- |
| Um processo escritor nos arquivos privados | Não executar várias APIs sobre os mesmos snapshots. Escala horizontal requer armazenamento e coordenação próprios |
| Avaliações/liberações/rubricas/vínculos em arquivos distintos | Backup consistente exige parar o escritor e copiar o conjunto com projetos e bytes; não há transação distribuída |
| Conteúdo depende de disco privado persistente | Registrar metadados não garante existência dos arquivos. Restaurar snapshots sem `UPLOAD_DIR` impede abrir materiais e novas publicações |
| Sessões locais em memória | Reinício exige novo login; sessões Google usam PostgreSQL |
| Consentimento registrado pelo docente | Há referência privada de autorização; não há assinatura eletrônica ou coleta automática da manifestação dos integrantes |
| Retirada vale para novas requisições | `no-store` e revalidação bloqueiam URLs copiadas, HEAD e Range. Bytes já recebidos e streams iniciados podem permanecer com o visitante |
| Finalização encerra a rodada | Avaliações e devolução não podem ser reabertas após `FINALIZADO`; retirar a publicação não reabre a avaliação |
| Uma faixa de bytes por requisição | Vídeo aceita Range simples; requisições com vários intervalos recebem 416 |
| Testes mobile usam Chromium emulado | Não demonstram dispositivo físico ou Safari |
| Login Google real e instalação limpa Ubuntu 26.04 | Exigem evidências próprias do ambiente e responsáveis (#46); a execução local não as substitui |
| Modelo SQL mais amplo que os adapters atuais | Projetos, entregas, avaliações e publicação não foram migrados integralmente ao PostgreSQL; novas migrations não são justificadas apenas pelo DER |
| Histórico/favoritos/estatísticas/recomendações | HU13–HU14 permanecem propostas, sem implementação nesta entrega |
| Decisão sobre escopo acadêmico | Sem decisão verificável disponível nesta entrega. Tema adaptado, assinaturas, idade e receita permanecem pendentes do professor; [requisitos pendentes de decisão](../README.md#alinhamento-com-o-enunciado-geral) |
| Revisão cruzada e vídeos finais | O roteiro está na apresentação. Aprovação de outro integrante, cinco vídeos revisados e retrospectiva dependem de registros humanos; não presumidos |

As rotas legadas `/api/public/projects` continuam dependendo de um provedor específico e não substituem o C4. O acervo integrado usa `/api/catalog`. `/demo/acervo` é demonstração de componentes no desenvolvimento; não é a evidência de publicação real.
