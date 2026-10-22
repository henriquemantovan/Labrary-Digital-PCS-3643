# Instruções para IAs — Labrary Digital

## Contexto do projeto

- Monorepo pnpm com API Express/TypeScript em `packages/api` e interface React/Vite em `packages/web`.
- Consulte os critérios da HU no `README.md` e o código atual antes de implementar. O README também contém funcionalidades planejadas: não as trate como prontas.
- Contratos atuais: `docs/api-inicial.md`. Sessões e permissões: `docs/hu01.md`.
- Projetos, metadados de materiais e sessões ainda ficam em memória. Prisma/PostgreSQL estão modelados; registrar metadados não equivale a persistir arquivos.
- Use as versões de `.nvmrc` e `package.json`, pnpm e o lockfile existente. Não troque dependências para contornar falhas de ambiente.

## Código acompanhado de testes executados pela IA

Ao implementar funcionalidades, corrigir bugs ou refatorar código, aplique [labrary-testar-e-corrigir](.agents/skills/labrary-testar-e-corrigir/SKILL.md), mesmo sem pedido explícito de testes.

1. Defina os comportamentos esperados e adicione ou ajuste testes automatizados relevantes junto com o código. Para bugs, reproduza o defeito em um teste antes da correção quando viável.
2. Execute você mesmo os testes pelo terminal. Sugerir comandos ao usuário não substitui executá-los quando há acesso ao ambiente.
3. Corrija as falhas causadas pela alteração e repita os testes afetados. Antes de entregar código, execute `pnpm build` e `pnpm test` na raiz. Execute também `pnpm test:e2e` quando mudar um fluxo pelo navegador, sessão, navegação, integração web/API ou comportamento responsivo.
4. Preserve a cobertura mínima de 85% nas quatro métricas da API e da web. Não reduza limites, exclua código da cobertura, pule testes ou enfraqueça asserções para obter sucesso.
5. Se faltar uma ferramenta, dependência ou serviço, tente resolver o ambiente dentro do escopo local autorizado. Se persistir um impedimento externo, informe o comando, o erro e o que não foi validado. Diferencie falha preexistente de regressão; não anuncie sucesso com verificação pendente.
6. Na entrega, diga o que mudou, quais comandos realmente executou, se passaram ou falharam e quais falhas corrigiu. Use contagens e cobertura somente quando obtidas na execução atual.

Alterações exclusivamente de documentação ou skills não exigem rodar toda a aplicação: valide os arquivos, links e comandos afetados. Mudanças apenas visuais usam as verificações de interface pertinentes; não crie testes que apenas repitam detalhes da implementação.

## Skills do repositório

As skills estão versionadas em `.agents/skills/` para serem compartilhadas com a equipe:

- [labrary-testar-e-corrigir](.agents/skills/labrary-testar-e-corrigir/SKILL.md): selecionar testes, executar, diagnosticar, corrigir e relatar resultados.
- [labrary-api-rest](.agents/skills/labrary-api-rest/SKILL.md): implementar rotas, regras e permissões da API.
- [labrary-interface-react](.agents/skills/labrary-interface-react/SKILL.md): implementar telas e integração HTTP acessíveis e responsivas.

Leia a skill correspondente antes de atuar na área. Instruções de uso e exemplos estão em [docs/desenvolvimento-com-ia.md](docs/desenvolvimento-com-ia.md).
