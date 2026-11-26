import { config } from "dotenv";
import { Pool } from "pg";
import { copyFile, mkdir, readFile, chmod } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { importAcademicData } from "../repositories/importAcademicData.js";
import { domainDefaults, type Domain } from "../repositories/postgresDomainRepositories.js";
import { loadR2Config } from "../services/storageConfiguration.js";
import { r2UsageSchema } from "../services/r2Usage.js";

const root = resolve(process.cwd(), "../..");
config({ path: resolve(root, ".env"), quiet: true });
const file = process.env.PROJECT_DATA_FILE ?? resolve(root, ".data/projects-google.json");
const paths = {
  projects: file,
  rubrics: process.env.RUBRIC_DATA_FILE ?? `${file}.rubrics.json`,
  evaluations: process.env.EVALUATION_DATA_FILE ?? `${file}.evaluations.json`,
  results: process.env.RESULT_RELEASE_DATA_FILE ?? `${file}.results.json`,
};
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  if (!process.env.DATABASE_URL) throw new Error("Configure DATABASE_URL antes de importar.");
  const backup = resolve(root, ".data/backup-migracao-postgresql", new Date().toISOString().replaceAll(":", "-"));
  const data = {} as Record<Domain, unknown>;
  await mkdir(backup, { recursive: true, mode: 0o700 });
  for (const domain of Object.keys(paths) as Domain[]) {
    try {
      data[domain] = JSON.parse(await readFile(paths[domain], "utf8"));
      const target = resolve(backup, `${domain}-${basename(paths[domain])}`);
      await copyFile(paths[domain], target);
      await chmod(target, 0o600);
    } catch (error) {
      if (domain === "projects" || (error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      data[domain] = structuredClone(domainDefaults[domain]);
    }
  }
  let usage;
  if (process.env.STORAGE_PROVIDER === "r2") {
    const settings = loadR2Config(process.env, root, file);
    usage = r2UsageSchema.parse(JSON.parse(await readFile(settings.usageFile, "utf8")));
    if (usage.scope !== settings.scope) throw new Error("Controle R2 pertence a outra conta ou bucket.");
    const target = resolve(backup, "r2-usage.json");
    await copyFile(settings.usageFile, target);
    await chmod(target, 0o600);
  }
  const result = await importAcademicData(pool, data, usage);
  console.log(result.imported ? "Dados acadêmicos e controle R2 importados no PostgreSQL." : "Importação já realizada; dados atuais preservados.");
  console.log("Os arquivos originais e uma cópia privada de segurança foram preservados.");
} catch (error) {
  // Erros de conexão podem conter o endereço privado do banco.
  console.error(error instanceof Error && !/password|postgres(?:ql)?:\/\//i.test(error.message) ? error.message : "Não foi possível importar. Confira a conexão PostgreSQL e as migrations.");
  process.exitCode = 1;
} finally {
  await pool.end();
}
