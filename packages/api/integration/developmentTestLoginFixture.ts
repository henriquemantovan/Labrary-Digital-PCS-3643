// Servidores isolados de navegador; nunca importados pelo entrypoint normal.
import { createApp } from "../src/app.js";
import { createDemoDirectory } from "../src/fixtures/demo.js";
import { createAuthRepository } from "../src/repositories/authRepository.js";
import { createMemoryAcademicAccessRepository } from "../src/repositories/academicAccessRepository.js";
import { createMemoryOAuthAttempts } from "../src/repositories/oauthAttemptRepository.js";
import { createMemoryProjectRepository } from "../src/repositories/projectRepository.js";
import { createGoogleOAuth } from "../src/services/googleOAuth.js";
import { hashPassword } from "../src/services/password.js";
import { developmentTestAccounts, developmentTestPassword } from "../src/services/developmentTestAccounts.js";

const passwordHash = await hashPassword(developmentTestPassword);
for (const [apiPort, webPort] of [[3010, 5186], [3012, 5188]]) {
  const directory = await createDemoDirectory();
  directory.users[0].email = "pessoa@usp.br";
  directory.users[0].googleLinked = true;
  for (const [index, person] of developmentTestAccounts.entries())
    directory.users.push({ id: index + 4, ...person, active: true, googleLinked: false, passwordHash });
  directory.classes[0].professorId = 5;
  directory.groups[0].memberIds = [9];
  directory.groups[1].memberIds = [7, 8];
  directory.assignments = [{ projectId: 2, evaluatorId: 6 }];
  const auth = createAuthRepository(directory);
  auth.developmentTestLogin = true;
  const academicAccess = createMemoryAcademicAccessRepository(auth);
  await academicAccess.invite(4, "convidado@labrary.test", Date.now());
  // Métodos e sessões compartilhados: desligar a exceção deve revogar o token.
  const disabled = { ...auth, developmentTestLogin: false };
  const repository = createMemoryProjectRepository();
  for (const [port, currentWebPort, current] of [
    [apiPort, webPort, auth], [apiPort + 1, webPort + 1, disabled],
  ] as const) {
    const origin = `http://localhost:${currentWebPort}`;
    const google = {
      origin,
      client: createGoogleOAuth({ clientId: "cliente-fixture", clientSecret: "segredo-fixture", callbackUrl: `${origin}/api/auth/google/callback` }),
      attempts: createMemoryOAuthAttempts(),
      saveProfile: async (): Promise<never> => { throw new Error("Este fixture verifica somente a exceção local de testes."); },
    };
    createApp({ auth: current, academicAccess, repository, google, localLogin: false, origin }).listen(port, "127.0.0.1");
  }
}
