import { Directory } from "../models/auth.js";
import { hashPassword } from "../services/password.js";

// Opt-in fixture. Never loaded by createApp or in production automatically.
export async function createDemoDirectory(): Promise<Directory> {
  const makeUser = async (
    id: number,
    fullName: string,
    email: string,
    role: Directory["users"][number]["role"],
  ) => ({
    id,
    fullName,
    email,
    role,
    active: true,
    passwordHash: await hashPassword("Labrary@2026"),
  });
  return {
    users: [
      await makeUser(1, "Marina Oliveira", "aluno@labrary.local", "ALUNO"),
      await makeUser(2, "Rafael Costa", "avaliador@labrary.local", "AVALIADOR"),
      await makeUser(
        3,
        "Helena Almeida",
        "professor@labrary.local",
        "PROFESSOR",
      ),
    ],
    classes: [
      {
        id: 1,
        name: "Laboratório de Sistemas Digitais",
        academicYear: 2026,
        professorId: 3,
      },
    ],
    groups: [
      { id: 1, classId: 1, name: "Grupo 01", memberIds: [] },
      { id: 2, classId: 1, name: "Grupo 02", memberIds: [1] },
      { id: 3, classId: 1, name: "Grupo 03", memberIds: [] },
    ],
    assignments: [{ projectId: 1, evaluatorId: 2 }],
  };
}
