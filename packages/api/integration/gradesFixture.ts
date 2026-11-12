// Servidor exclusivo do Playwright; nunca importado pelo entrypoint de produção.
import { createApp } from "../src/app.js";
import { createDemoDirectory } from "../src/fixtures/demo.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";
import { createResultReleaseRepository } from "../src/repositories/resultReleaseRepository.js";
import { evaluationContractExamples } from "../src/test/evaluationContractExamples.js";
const directory = await createDemoDirectory();
directory.groups[0].memberIds = [1];
directory.groups[1].memberIds = [];
const auth = createAuthRepository(directory);
createApp({
  auth, origin: `http://localhost:${process.env.GRADES_WEB_PORT}`,
  resultReleases: createResultReleaseRepository(process.env.RESULT_RELEASE_DATA_FILE),
  evaluations: { async getCurrentRound(projectId) {
    return projectId === 1 ? evaluationContractExamples().finalized : undefined;
  } },
}).listen(Number(process.env.GRADES_API_PORT));
