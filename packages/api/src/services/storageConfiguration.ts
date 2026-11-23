import { resolve } from "node:path";
import { S3Client } from "@aws-sdk/client-s3";
import { resolveUploadDir } from "./configuration.js";
import { createDiskStorage } from "./fileStorage.js";
import { createR2Storage } from "./r2Storage.js";
import { createR2UsageLimiter } from "./r2Usage.js";

export function loadR2Config(
  env: NodeJS.ProcessEnv,
  repositoryRoot: string,
  dataFile: string,
) {
  if (!/^[a-f0-9]{32}$/.test(env.R2_ACCOUNT_ID ?? ""))
    throw new Error(
      "Configure R2_ACCOUNT_ID com o identificador da conta Cloudflare.",
    );
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(env.R2_BUCKET ?? ""))
    throw new Error("Configure R2_BUCKET com o nome do bucket privado.");
  if (!env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY)
    throw new Error(
      "Configure as credenciais R2 somente no ambiente privado da API.",
    );
  return {
    accountId: env.R2_ACCOUNT_ID!,
    bucket: env.R2_BUCKET!,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    usageFile: env.R2_USAGE_FILE
      ? resolve(repositoryRoot, env.R2_USAGE_FILE)
      : `${resolve(dataFile)}.r2-usage.json`,
    scope: `${env.R2_ACCOUNT_ID}/${env.R2_BUCKET}`,
  };
}

export function createConfiguredStorage(
  env: NodeJS.ProcessEnv,
  repositoryRoot: string,
  dataFile: string,
) {
  const provider = env.STORAGE_PROVIDER || "disk";
  if (provider === "disk")
    return createDiskStorage(resolveUploadDir(env, repositoryRoot));
  if (provider !== "r2")
    throw new Error("STORAGE_PROVIDER deve ser disk ou r2.");
  const config = loadR2Config(env, repositoryRoot, dataFile);
  const usage = createR2UsageLimiter(config.usageFile, config.scope);
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    // Cada tentativa precisa estar contabilizada; não repetir implicitamente.
    maxAttempts: 1,
    forcePathStyle: true,
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return createR2Storage({
    client,
    bucket: config.bucket,
    reserve: usage.reserve,
  });
}
