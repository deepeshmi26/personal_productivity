import { cardQuestionsTable, db, questionGenerationJobsTable, responsesTable } from "@workspace/db";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { generateQuestion } from "../lib/questionGeneration";
import { logger } from "../lib/logger";

const MAX_ATTEMPTS = 3;
const STALE_JOB_MS = 5 * 60 * 1000;

async function recordJobFailure(
    job: { id: number; responseId: number; attemptCount: number },
    err: unknown,
) {
    const lastError = err instanceof Error ? err.message : "Unknown question generation error";
    const shouldRetry = job.attemptCount < MAX_ATTEMPTS;

    try {
        await db
            .update(questionGenerationJobsTable)
            .set({
                status: shouldRetry ? "pending" : "failed",
                lastError: lastError.slice(0, 1000),
                updatedAt: sql`NOW()`,
            })
            .where(eq(questionGenerationJobsTable.id, job.id));
    } catch (markErr) {
        logger.error(
            {
                err: markErr,
                originalErr: err,
                jobId: job.id,
                responseId: job.responseId,
            },
            "Question worker: failed to record job failure",
        );
    }
}

export async function processQuestionGenerationJobOnce() {
    const cutoff = new Date(Date.now() - STALE_JOB_MS);

    try {
        await db.update(questionGenerationJobsTable)
            .set({
                status: "failed",
                lastError: "Worker stale: max attempts exceeded",
                updatedAt: sql`NOW()`,
            })
            .where(
                and(
                    eq(questionGenerationJobsTable.status, "running"),
                    gte(questionGenerationJobsTable.attemptCount, MAX_ATTEMPTS),
                    lt(questionGenerationJobsTable.updatedAt, cutoff),
                ),
            );

        await db
            .update(questionGenerationJobsTable)
            .set({
                status: "pending",
                lastError: "Worker stale: retrying job after 5 minutes",
                updatedAt: sql`NOW()`,
            })
            .where(
                and(
                    eq(questionGenerationJobsTable.status, "running"),
                    lt(questionGenerationJobsTable.updatedAt, cutoff),
                ),
            );
    } catch (err) {
        logger.error({ err }, "Question worker: stale job recovery failed");
    }

    let processed = false;
    let claimedJob: {
        id: number;
        responseId: number;
        attemptCount: number;
    } | null = null;

    try {
        claimedJob = await db.transaction(async (tx) => {
            const [job] = await tx
                .select()
                .from(questionGenerationJobsTable)
                .where(eq(questionGenerationJobsTable.status, "pending"))
                .orderBy(questionGenerationJobsTable.createdAt)
                .limit(1)
                .for("update", { skipLocked: true });

            if (!job) return null;

            const [existingQuestion] = await tx
                .select({ id: cardQuestionsTable.id })
                .from(cardQuestionsTable)
                .where(eq(cardQuestionsTable.responseId, job.responseId))
                .limit(1);


            if (existingQuestion) {
                await tx
                    .update(questionGenerationJobsTable)
                    .set({
                        status: "completed",
                        updatedAt: sql`NOW()`,
                    })
                    .where(eq(questionGenerationJobsTable.id, job.id));
                processed = true;
                return null;
            }

            const [updatedJob] = await tx
                .update(questionGenerationJobsTable)
                .set({
                    status: "running",
                    attemptCount: sql`${questionGenerationJobsTable.attemptCount} + 1`,
                    updatedAt: sql`NOW()`,
                })
                .where(eq(questionGenerationJobsTable.id, job.id))
                .returning();

            processed = true;
            return updatedJob;
        });
    } catch (err) {
        logger.error({ err }, "Question worker: failed to claim job");
        return;
    }

    if (!claimedJob) return processed;

    try {
        const [response] = await db
            .select({
                id: responsesTable.id,
                text: responsesTable.text,
            })
            .from(responsesTable)
            .where(eq(responsesTable.id, claimedJob.responseId))
            .limit(1);

        if (!response) {
            logger.warn(
                { jobId: claimedJob.id, responseId: claimedJob.responseId },
                "Question worker: source response missing, completing job as no-op",
            );
            await db
                .update(questionGenerationJobsTable)
                .set({
                    status: "completed",
                    lastError: "Source response no longer exists",
                    updatedAt: sql`NOW()`,
                })
                .where(eq(questionGenerationJobsTable.id, claimedJob.id));
            return true;
        }

        const question = await generateQuestion(response.text);
        if (!question) {
            throw new Error("AI returned empty question");
        }

        await db
            .insert(cardQuestionsTable)
            .values({
                responseId: response.id,
                question,
            }).onConflictDoNothing();

        await db
            .update(questionGenerationJobsTable)
            .set({
                status: "completed",
                updatedAt: sql`NOW()`,
            })
            .where(eq(questionGenerationJobsTable.id, claimedJob.id));
    } catch (err) {
        logger.error(
            { err, jobId: claimedJob.id, responseId: claimedJob.responseId },
            "Question worker: claimed job processing failed",
        );

        await recordJobFailure(claimedJob, err);
    }

    return true;
}


const WORKER_COUNT = 5;
let isWorkerRunning = false
export async function runQuestionGenerator() {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    try {
        await Promise.all(
            Array.from({ length: WORKER_COUNT }, async () => {
                while (await processQuestionGenerationJobOnce()) {
                    // keep going
                }
            }),
        );
    } finally {
        isWorkerRunning = false;
    }
}
