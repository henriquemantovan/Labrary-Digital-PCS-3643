import { Catalog } from "./Catalog";
import { demoCatalog } from "./fixtures/catalog";

export default function CatalogDemo() {
  return <Catalog provider={demoCatalog} demo basePath="/demo/acervo" />;
}
