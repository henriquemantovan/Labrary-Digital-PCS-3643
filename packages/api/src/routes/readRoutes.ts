import { Router } from "express";
import { z } from "zod";
import { ApiError } from "../errors.js";
import type { PublicProject, ReadProviders } from "../models/readModels.js";
import type { AuthRepository } from "../repositories/authRepository.js";
import type { ProjectRepository } from "../repositories/projectRepository.js";
import { createPermissions } from "../services/permissions.js";

const id = z.coerce.number().int().positive();
const filters = z.object({ title: z.string().max(200).optional(), year: id.optional(), className: z.string().optional(), category: z.string().optional() }).strict();
const unavailable = () => new ApiError(503, "PROVIDER_UNAVAILABLE", "Este serviço ainda não está disponível. Tente novamente mais tarde.");
const missing = () => new ApiError(404, "PROJECT_NOT_FOUND", "Projeto não encontrado.");
// Allowlist: nunca serializar objetos internos do produtor diretamente.
function present(p: PublicProject) {
  return { id: p.id, title: p.title, description: p.description, year: p.year, className: p.className, category: p.category, published: true,
    materials: p.materials.filter(m => /^\/api\/public\/materials\/[1-9]\d*\/content$/.test(m.url)).map(m => ({ versionId: m.versionId, title: m.title, kind: m.kind, url: m.url })) };
}
export function createReadRouter(providers: ReadProviders, repository: ProjectRepository, auth: AuthRepository) {
  const router = Router();
  router.get("/projects/:projectId/result", async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    const project = repository.get(projectId);
    const user = res.locals.user;
    if (!project || user.role !== "ALUNO" || !createPermissions(auth).canRead(user, project)) throw missing();
    if (!providers.result) throw unavailable();
    const result = await providers.result.get(projectId);
    if (!result) throw unavailable();
    if (result.projectId !== projectId || result.groupId !== project.groupId) throw missing();
    res.json({ data: { projectId, groupId: project.groupId, round: result.round, expected: result.expected, received: result.received, pending: result.pending, complete: result.complete, released: result.released,
      grade: result.released ? result.grade : null, rubricVersionId: result.released ? result.rubricVersionId : null,
      criteria: result.released ? result.criteria.map(c => ({ title: c.title, weight: c.weight, grade: c.grade, comment: c.comment })) : [] } });
  });
  router.get("/public/projects", async (req, res) => {
    const q = filters.parse(req.query);
    if (!providers.publications) throw unavailable();
    const projects = await providers.publications.list();
    res.json({ data: projects.filter(p => p.published && (!q.title || p.title.toLocaleLowerCase("pt-BR").includes(q.title.trim().toLocaleLowerCase("pt-BR"))) && (!q.year || p.year === q.year) && (!q.className || p.className === q.className) && (!q.category || p.category === q.category)).map(present) });
  });
  router.get("/public/projects/:projectId", async (req, res) => {
    const projectId = id.parse(req.params.projectId);
    if (!providers.publications) throw unavailable();
    const project = await providers.publications.get(projectId);
    if (!project?.published || project.id !== projectId) throw missing();
    res.json({ data: present(project) });
  });
  return router;
}
