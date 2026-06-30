import { Router, type IRouter } from "express";
import { db, responseProcessingJobsTable, responsesTable } from "@workspace/db";
import { desc, sql, eq } from "drizzle-orm";
import { CreateResponseBody, UpdateResponseBody } from "@workspace/api-zod";
import { InvalidRequestError, ResourceNotFoundError } from "../errors";

const router: IRouter = Router();

router.get("/responses", async (_req, res) => {
  const rows = await db
    .select()
    .from(responsesTable)
    .orderBy(desc(responsesTable.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      text: r.text,
      skipped: r.skipped,
      createdAt: r.createdAt.toISOString(),
    })),
  );
});

router.post("/responses", async (req, res) => {
  const parsed = CreateResponseBody.safeParse(req.body);
  if (!parsed.success) {
    throw new InvalidRequestError("Invalid body");
  }
  const row = await db.transaction(async (tx) => {
    const [response] = await tx
      .insert(responsesTable)
      .values({
        text: parsed.data.text,
        skipped: parsed.data.skipped,
      })
      .returning();
    await tx.insert(responseProcessingJobsTable).values({ responseId: response.id })
    return response;
  })

  res.status(201).json({
    id: row.id,
    text: row.text,
    skipped: row.skipped,
    createdAt: row.createdAt.toISOString(),
  });
});

router.patch("/responses/:responseId", async (req, res) => {
  const responseId = parseInt(req.params["responseId"] ?? "", 10);
  if (isNaN(responseId)) {
    throw new InvalidRequestError("The url does not contain the response id");
  }

  const parsed = UpdateResponseBody.safeParse(req.body);
  if (!parsed.success) {
    throw new InvalidRequestError("Invalid body");
  }

  const text = parsed.data.text;


  const [row] = await db.update(responsesTable).set({ text: text }).where(eq(responsesTable.id, responseId)).returning()

  if (!row) {
    throw new ResourceNotFoundError("The requested response id was not found");
  }

  res.status(200).json({
    id: row.id,
    text: row.text,
    skipped: row.skipped,
    createdAt: row.createdAt.toISOString(),
  });
})
router.get("/responses/stats", async (_req, res) => {
  const totals = await db
    .select({
      total: sql<number>`count(*)::int`,
      answered: sql<number>`sum(case when ${responsesTable.skipped} = false then 1 else 0 end)::int`,
      skipped: sql<number>`sum(case when ${responsesTable.skipped} = true then 1 else 0 end)::int`,
    })
    .from(responsesTable);

  const days = await db
    .select({
      date: sql<string>`to_char(${responsesTable.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(responsesTable)
    .groupBy(sql`to_char(${responsesTable.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${responsesTable.createdAt}, 'YYYY-MM-DD') desc`)
    .limit(30);

  const t = totals[0] ?? { total: 0, answered: 0, skipped: 0 };
  res.json({
    total: t.total ?? 0,
    answered: t.answered ?? 0,
    skipped: t.skipped ?? 0,
    days: days.map((d) => ({ date: d.date, count: d.count ?? 0 })),
  });
});

export default router;
