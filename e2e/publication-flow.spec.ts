import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { test, expect, type Page } from "@playwright/test";

const project = "/api/projects/2";
const csrf = { "X-CSRF-Protection": "1" };
const reference =
  "Autorização demonstrativa do Grupo 02 para vídeo e relatório.";

async function login(page: Page, role: "professor" | "aluno" | "avaliador") {
  const logout = page.getByRole("button", {
    name: "Sair da conta",
    exact: true,
  });
  if (await logout.isVisible()) {
    await logout.click();
    await expect(page.getByLabel("E-mail institucional")).toBeVisible();
  }
  await page.goto("/projetos/2");
  await page.getByLabel("E-mail institucional").fill(`${role}@labrary.local`);
  await page.getByLabel("Senha", { exact: true }).fill("Labrary@2026");
  await page.getByRole("button", { name: "Entrar no meu espaço" }).click();
  await expect(logout).toBeVisible();
}

test("S7 integra submissão, avaliação, publicação e retirada pelo servidor normal", async ({
  page,
  browser,
  baseURL,
}, info) => {
  const visitor = await browser.newContext({ baseURL });
  try {
    await test.step("Preparar vínculos e rubrica reais", async () => {
      await login(page, "professor");
      expect(
        (
          await page.request.put(`${project}/evaluators`, {
            headers: csrf,
            data: { evaluatorIds: [2] },
          })
        ).status(),
      ).toBe(200);
      expect(
        (
          await page.request.post(`${project}/configuration/versions`, {
            headers: csrf,
            data: {
              baseVersionId: 0,
              title: "Rubrica da demonstração integrada",
              requirements: [
                {
                  kind: "VIDEO",
                  label: "Vídeo de apresentação",
                  allowedMimeTypes: ["video/webm"],
                },
                {
                  kind: "RELATORIO",
                  label: "Relatório do projeto",
                  allowedMimeTypes: ["application/pdf"],
                },
                {
                  kind: "MANUAL",
                  label: "Manual de uso",
                  allowedMimeTypes: ["application/pdf"],
                },
              ].map((item) => ({
                ...item,
                required: true,
                maxSizeBytes: 1048576,
                dueAt: "2099-11-25T23:59:00-03:00",
              })),
              criteria: [
                {
                  id: "funcionamento",
                  title: "Funcionamento",
                  description: "",
                  weight: 100,
                  minScore: 0,
                  maxScore: 10,
                },
              ],
            },
          })
        ).status(),
      ).toBe(201);
    });

    await test.step("Aluno envia bytes privados e submete a rodada", async () => {
      await login(page, "aluno");
      await page
        .getByLabel("Arquivo para Vídeo de apresentação")
        .setInputFiles(resolve("e2e/fixtures/demonstracao.webm"));
      for (const [label, filename] of [
        ["Relatório do projeto", "relatorio.pdf"],
        ["Manual de uso", "manual.pdf"],
      ]) {
        await page
          .getByLabel(`Arquivo para ${label}`)
          .setInputFiles({
            name: filename,
            mimeType: "application/pdf",
            buffer: Buffer.from(
              `%PDF-1.7\nDocumento demonstrativo: ${label}\n%%EOF\n`,
            ),
          });
      }
      const delivery = page.getByRole("region", {
        name: "Entrega para avaliação",
      });
      await expect(
        delivery.getByText("3 de 3 obrigatórios prontos"),
      ).toBeVisible();
      await delivery
        .getByRole("button", { name: "Submeter para avaliação" })
        .click();
      await delivery
        .getByRole("button", { name: "Confirmar submissão" })
        .click();
      await expect(
        delivery.getByText("Projeto submetido. A rodada 1 está em avaliação."),
      ).toBeVisible();
      expect((await visitor.request.get("/api/catalog/2")).status()).toBe(404);
    });

    await test.step("Avaliação finalizada alimenta a consolidação real", async () => {
      await login(page, "avaliador");
      await page
        .getByRole("button", { name: "Avaliações por rubrica", exact: true })
        .click();
      const evaluation = page.getByRole("region", {
        name: "Avaliações por rubrica",
      });
      await evaluation
        .getByLabel("Nota — Funcionamento", { exact: true })
        .fill("9");
      await evaluation
        .getByLabel("Comentário — Funcionamento", { exact: true })
        .fill("Parecer privado da avaliação integrada.");
      await evaluation
        .getByRole("button", { name: "Finalizar avaliação" })
        .click();
      await expect(evaluation.getByText("Avaliação finalizada.")).toBeVisible();
      expect(
        (
          await page.request.post(`${project}/messages`, {
            headers: csrf,
            data: {
              clientMessageId: randomUUID(),
              body: "Feedback confidencial da demonstração.",
            },
          })
        ).status(),
      ).toBe(201);
    });

    const publication = page.getByRole("region", {
      name: "Finalização e publicação",
    });
    await test.step("Professor finaliza sem publicar ou liberar notas automaticamente", async () => {
      await login(page, "professor");
      const consolidation = await page.request.get(
        `${project}/results/consolidation`,
      );
      expect(consolidation.status()).toBe(200);
      expect((await consolidation.json()).data.result).toMatchObject({
        allEvaluationsCompleted: true,
        resultReleased: false,
        finalGrade: 9,
      });
      await publication
        .getByLabel("Confirmo a finalização desta rodada.")
        .check();
      await publication
        .getByRole("button", { name: "Finalizar projeto" })
        .click();
      await expect(
        publication.getByText(
          "Projeto finalizado. O conteúdo continua privado.",
        ),
      ).toBeVisible();
      expect((await visitor.request.get("/api/catalog/2")).status()).toBe(404);
    });

    await test.step("Professor registra autorização apenas de vídeo e relatório", async () => {
      await publication.getByLabel("Vídeo de apresentação · v1").check();
      await publication.getByLabel("Relatório do projeto · v1").check();
      await publication
        .getByLabel(
          "O grupo autorizou a divulgação dos materiais selecionados.",
        )
        .check();
      await publication
        .getByLabel("Registro da autorização do grupo")
        .fill(reference);
      await publication
        .getByRole("button", { name: "Publicar no acervo" })
        .click();
      await expect(
        publication.getByText(
          "Projeto publicado com os materiais autorizados.",
        ),
      ).toBeVisible();
      await publication.screenshot({
        path: info.outputPath("publicacao-integrada.png"),
      });
    });

    const dtoResponse = await visitor.request.get("/api/catalog/2");
    expect(dtoResponse.status()).toBe(200);
    const dto = (await dtoResponse.json()).data;
    await test.step("Visitante reproduz vídeo real sem acessar documentos privados", async () => {
      await page
        .getByRole("button", { name: "Sair da conta", exact: true })
        .click();
      await page.goto("/acervo/2");
      const video = page.getByLabel("Vídeo de apresentação");
      await expect
        .poll(() =>
          video.evaluate((element: HTMLVideoElement) => element.readyState),
        )
        .toBeGreaterThanOrEqual(1);
      await video.evaluate((element: HTMLVideoElement) => element.play());
      await expect
        .poll(() =>
          video.evaluate((element: HTMLVideoElement) => element.currentTime),
        )
        .toBeGreaterThan(0);
      await expect(
        page.getByRole("link", { name: "Baixar Relatório do projeto" }),
      ).toBeVisible();
      await expect(
        page.getByText("Manual de uso", { exact: true }),
      ).toHaveCount(0);
      for (const secret of [
        "Parecer privado",
        "Feedback confidencial",
        reference,
        "storageKey",
        "checksumSha256",
        "rubric",
        "grade",
      ])
        expect(JSON.stringify(dto)).not.toContain(secret);
      expect(
        (await visitor.request.get("/api/catalog/2/materials/3/file")).status(),
      ).toBe(404);
      expect(
        (
          await visitor.request.get(dto.materials[0].contentUrl, {
            headers: { Range: "bytes=0-15" },
          })
        ).status(),
      ).toBe(206);
      expect((await visitor.request.get(`${project}/messages`)).status()).toBe(
        401,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: info.outputPath("acervo-integrado.png"),
        fullPage: true,
      });
    });

    await test.step("Retirada revoga URLs copiadas e conserva histórico e conteúdo privados", async () => {
      await login(page, "professor");
      await publication.getByLabel("Confirmo a retirada do acervo.").check();
      await publication
        .getByRole("button", { name: "Retirar publicação" })
        .click();
      await expect(
        publication.getByText(
          "Publicação retirada. O conteúdo privado foi preservado.",
        ),
      ).toBeVisible();
      expect((await visitor.request.get("/api/catalog")).ok()).toBe(true);
      expect(
        (await (await visitor.request.get("/api/catalog")).json()).data,
      ).toEqual([]);
      expect((await visitor.request.get("/api/catalog/2")).status()).toBe(404);
      for (const material of dto.materials) {
        expect((await visitor.request.get(material.contentUrl)).status()).toBe(
          404,
        );
        expect((await visitor.request.head(material.contentUrl)).status()).toBe(
          404,
        );
        expect(
          (
            await visitor.request.get(material.contentUrl, {
              headers: { Range: "bytes=0-15" },
            })
          ).status(),
        ).toBe(404);
      }
      await page.reload();
      await publication.getByText("Histórico de publicação (3)").click();
      await expect(
        publication.getByText(`Autorização: ${reference}`),
      ).toBeVisible();
      const materials = (
        await (await page.request.get(`${project}/materials`)).json()
      ).data;
      expect(materials).toHaveLength(3);
      await publication.screenshot({
        path: info.outputPath("retirada-integrada.png"),
      });
    });
  } finally {
    await visitor.close();
  }
});
