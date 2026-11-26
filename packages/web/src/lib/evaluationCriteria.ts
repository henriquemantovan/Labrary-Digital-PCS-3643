/** Atualiza a nomenclatura exibida sem modificar títulos históricos persistidos. */
export function evaluationCriteriaTitle(title: string): string {
  return title.replace(/\brubricas?\b/gi, (term) =>
    `${term[0] === "R" ? "C" : "c"}ritérios de avaliação`,
  );
}
