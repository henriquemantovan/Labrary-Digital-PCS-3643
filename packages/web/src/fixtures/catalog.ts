import example from "../../../../docs/contratos/c4-exemplo.json";
import { filterCatalog, parsePublicProject } from "../catalogClient";
import type { PublicPublicationProvider } from "../catalogClient";

export const catalogExamples = [
  parsePublicProject(example),
  parsePublicProject({
    ...example,
    id: 18,
    title: "Monitor de energia",
    category: "Instrumentação",
    materials: [],
  }),
  parsePublicProject({
    ...example,
    id: 19,
    title: "Contador didático",
    academicYear: 2025,
    class: { id: 4, name: "Sistemas Digitais 2025" },
    materials: [],
  }),
];

export const demoCatalog: PublicPublicationProvider = {
  async list(filter) {
    return structuredClone(filterCatalog(catalogExamples, filter));
  },
  async get(id) {
    return structuredClone(
      catalogExamples.find((project) => project.id === id),
    );
  },
};
