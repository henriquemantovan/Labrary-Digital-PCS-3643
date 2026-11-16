# Integração USP anterior — histórico

O login ativo foi substituído por [SSO Google](login-google.md). Rotas, serviços e variáveis de ambiente USP não são usados pela aplicação atual. As migrations `20261001000000_baseline` e `20261022000000_usp_identity` permanecem imutáveis, pois já foram aplicadas ao banco. Campos e dados USP são preservados pela migration Google.

Para configurar a autenticação atual, executar migrations e vincular contas existentes, siga [Login Google e PostgreSQL](login-google.md).
