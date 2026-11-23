# Limitações e pendências da entrega

Limites operacionais e pendências acadêmicas da aplicação. Os comandos estão na [validação da entrega](../README.md#validação-da-entrega); aprovação automatizada não equivale a aceite da equipe ou do professor.

| Limite | Consequência e acompanhamento |
| --- | --- |
| Um processo escritor nos arquivos privados | Não executar várias APIs sobre os mesmos snapshots. Escala horizontal requer armazenamento e coordenação próprios |
| Avaliações/liberações/rubricas/vínculos em arquivos distintos | Backup consistente exige parar o escritor e copiar o conjunto com projetos e bytes; não há transação distribuída |
| Conteúdo em disco privado ou R2 optativo | Registrar metadados não garante existência dos arquivos. Restaurar snapshots exige conservar `UPLOAD_DIR` ou os objetos R2 correspondentes; trocar o provedor não migra os bytes |
| R2 tem franquia gratuita e cobrança de excedentes | A API limita capacidade e operações com contador persistente, mas não controla uso externo ou cobranças da conta Cloudflare. Não garante custo zero absoluto; [configuração e limites](arquitetura.md#cloudflare-r2-e-controle-da-franquia-gratuita) |
| Sessões locais em memória | Reinício exige novo login; sessões Google usam PostgreSQL |
| Consentimento registrado pelo docente | Há referência privada de autorização; não há assinatura eletrônica ou coleta automática da manifestação dos integrantes |
| Retirada vale para novas requisições | `no-store` e revalidação bloqueiam URLs copiadas, HEAD e Range. Bytes já recebidos e streams iniciados podem permanecer com o visitante |
| Finalização encerra a rodada | Avaliações e devolução não podem ser reabertas após `FINALIZADO`; retirar a publicação não reabre a avaliação |
| Uma faixa de bytes por requisição | Vídeo aceita Range simples; requisições com vários intervalos recebem 416 |
| Testes mobile usam Chromium emulado | Não demonstram dispositivo físico ou Safari |
| Login Google real e instalação limpa Ubuntu 26.04 | Exigem evidências próprias do ambiente e responsáveis (#46); a execução local não as substitui |
| Modelo SQL mais amplo que os adapters atuais | Projetos, entregas, avaliações e publicação não foram migrados integralmente ao PostgreSQL; novas migrations não são justificadas apenas pelo DER |
| Histórico/favoritos/estatísticas/recomendações | HU13–HU14 foram excluídas do escopo desta entrega |
| Decisão sobre assinaturas | Fluxo acadêmico mantido; restrição etária, funcionalidades financeiras e HU13–HU14 dispensadas. Assinaturas e seus perfis ainda precisam de definição; [escopo da entrega](../README.md#alinhamento-com-o-enunciado-geral) |
| Revisão cruzada e vídeos finais | O roteiro está na apresentação. Aprovação de outro integrante, cinco vídeos revisados e retrospectiva dependem de registros humanos; não presumidos |

As rotas legadas `/api/public/projects` continuam dependendo de um provedor específico e não substituem o C4. O acervo integrado usa `/api/catalog`. `/demo/acervo` é demonstração de componentes no desenvolvimento; não é a evidência de publicação real.
