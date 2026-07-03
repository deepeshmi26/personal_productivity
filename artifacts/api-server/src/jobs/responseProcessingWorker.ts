import { cardQuestionsTable, db, responseProcessingJobsTable, responsesTable, responseThreadsTable, threadsTable } from "@workspace/db";
import { and, desc, eq, gte, isNull, lt, lte, or, sql } from "drizzle-orm";
import { classifyThreadCategory, generateQuestion, noiseClassifier } from "../lib/aiCallers";
import { logger } from "../lib/logger";

const MAX_ATTEMPTS = 3;
const STALE_JOB_MS = 5 * 60 * 1000;

type ClaimedJob = {
    id: number;
    responseId: number;
    attemptCount: number;
};

async function recordJobFailure(
    job: ClaimedJob,
    err: unknown,
) {
    const lastError = err instanceof Error ? err.message : "Unknown question generation error";
    const shouldRetry = job.attemptCount < MAX_ATTEMPTS;

    try {
        await db
            .update(responseProcessingJobsTable)
            .set({
                status: shouldRetry ? "pending" : "failed",
                lastError: lastError.slice(0, 1000),
                updatedAt: sql`NOW()`,
                nextAttemptAt: shouldRetry ? new Date(Date.now() + Math.pow(2, job.attemptCount - 1) * 10 * 1000) : null,
            })
            .where(eq(responseProcessingJobsTable.id, job.id));
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

async function recoverStaleRunningJobs() {
    const cutoff = new Date(Date.now() - STALE_JOB_MS);

    try {
        await db
            .update(responseProcessingJobsTable)
            .set({
                status: "failed",
                lastError: "Worker stale: max attempts exceeded",
                updatedAt: sql`NOW()`,
            })
            .where(
                and(
                    eq(responseProcessingJobsTable.status, "running"),
                    gte(responseProcessingJobsTable.attemptCount, MAX_ATTEMPTS),
                    lt(responseProcessingJobsTable.updatedAt, cutoff),
                ),
            );

        await db
            .update(responseProcessingJobsTable)
            .set({
                status: "pending",
                lastError: "Worker stale: retrying job after exponential backoff",
                updatedAt: sql`NOW()`,
                nextAttemptAt: sql`NOW() + POWER(2, ${responseProcessingJobsTable.attemptCount}) * INTERVAL '10 seconds'`
            })
            .where(
                and(
                    eq(responseProcessingJobsTable.status, "running"),
                    lt(responseProcessingJobsTable.updatedAt, cutoff),
                    lt(responseProcessingJobsTable.attemptCount, MAX_ATTEMPTS),
                ),
            );

    } catch (err) {
        logger.error({ err }, "Question worker: stale job recovery failed");
    }
}

async function processClaimedJob(claimedJob: ClaimedJob) {
    try {
        // ==================== PROCESS 1: Classify response as noise and mark completed if so ====================
        const [response] = await db
            .select({
                id: responsesTable.id,
                text: responsesTable.text,
                isNoise: responsesTable.isNoise
            })
            .from(responsesTable)
            .where(eq(responsesTable.id, claimedJob.responseId))
            .limit(1);

        if (response == null) {
            await db.update(responseProcessingJobsTable)
                .set({ status: "completed", lastError: "Source response no longer exists", updatedAt: sql`NOW()`, })
                .where(eq(responseProcessingJobsTable.id, claimedJob.id));

            return;
        }

        let isNoise = response.isNoise;

        if (isNoise == null) {
            isNoise = await noiseClassifier(response.text);
            await db.update(responsesTable).set({
                isNoise: isNoise
            }).where(eq(responsesTable.id, claimedJob.responseId))
        }

        if (isNoise) {
            await db.update(responseProcessingJobsTable).set({ status: "completed", updatedAt: sql`NOW()`, }).where(eq(responseProcessingJobsTable.id, claimedJob.id))
            return;
        }

        // ==================== PROCESS 2: Thread classification and responseThreadsTable connection ====================
        const [response_thread] = await db
            .select()
            .from(responseThreadsTable)
            .where(eq(responseThreadsTable.responseId, claimedJob.responseId))
            .limit(1);

        if (response_thread == null) {
            // Get all existing threads and their ids
            const existingThreads = await db
                .select({
                    id: threadsTable.id,
                    label: threadsTable.label
                })
                .from(threadsTable);

            // Make API call to classify thread category
            const result = await classifyThreadCategory(response.text);
            const returnedLabel = result.category;
            const confidence = result.confidence;

            // Check if returned category already exists
            let threadId: number | null = null;
            const foundThread = existingThreads.find(t => t.label === returnedLabel);

            if (foundThread) {
                threadId = foundThread.id;
            } else {
                // Insert new category into threads table
                const [thread] = await db
                    .insert(threadsTable)
                    .values({ label: returnedLabel })
                    .onConflictDoUpdate({
                        target: threadsTable.label,
                        set: {
                            label: sql`excluded.label`,
                        },
                    })
                    .returning({ id: threadsTable.id });
                threadId = thread?.id;
                if (!threadId) throw new Error("Thread insert failed");
            }

            // Create entry in responseThreadsTable
            await db
                .insert(responseThreadsTable)
                .values({
                    threadId: threadId,
                    responseId: claimedJob.responseId,
                    confidence: confidence
                });
        }

        // ==================== PROCESS 3: Generate card question if needed ====================
        const [cardQuestion] = await db
            .select()
            .from(cardQuestionsTable)
            .where(eq(cardQuestionsTable.responseId, claimedJob.responseId))
            .limit(1);

        if (cardQuestion == null) {
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
        }

        await db
            .update(responseProcessingJobsTable)
            .set({
                status: "completed",
                updatedAt: sql`NOW()`,
            })
            .where(eq(responseProcessingJobsTable.id, claimedJob.id));
    } catch (err) {
        logger.error(
            { err, jobId: claimedJob.id, responseId: claimedJob.responseId },
            "Question worker: claimed job processing failed",
        );

        await recordJobFailure(claimedJob, err);
    }
}

export async function processOneResponseJob() {
    await recoverStaleRunningJobs();

    let claimedJob: ClaimedJob | null = null;

    try {
        claimedJob = await db.transaction(async (tx) => {
            //Get the first job which is in pending state i.e. it has not been started yet
            const [job] = await tx
                .select()
                .from(responseProcessingJobsTable)
                .where(
                    and(
                        eq(responseProcessingJobsTable.status, "pending"),
                        or(
                            isNull(responseProcessingJobsTable.nextAttemptAt),
                            lte(responseProcessingJobsTable.nextAttemptAt, sql`NOW()`)
                        )
                    )
                )

                .orderBy(desc(responseProcessingJobsTable.priority), responseProcessingJobsTable.createdAt)
                .limit(1)
                .for("update", { skipLocked: true });


            if (!job) return null;

            /**
            * Mark it as running so that no other worker picks it up. The value of status is moved back to pending in {@link recoverStaleRunningJobs}.
            */
            const [updatedJob] = await tx
                .update(responseProcessingJobsTable)
                .set({
                    status: "running",
                    attemptCount: sql`${responseProcessingJobsTable.attemptCount} + 1`,
                    updatedAt: sql`NOW()`,
                })
                .where(eq(responseProcessingJobsTable.id, job.id))
                .returning();
            return updatedJob;
        });
    } catch (err) {
        logger.error({ err }, "Question worker: failed to claim job");
        return;
    }

    if (!claimedJob) return false;

    await processClaimedJob(claimedJob);
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
                while (await processOneResponseJob()) {
                    // keep going
                }
            }),
        );
    } finally {
        isWorkerRunning = false;
    }
}
