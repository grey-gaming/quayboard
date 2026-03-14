import {
  questionnaireAnswerMapSchema,
  questionnaireAnswersSchema,
  questionnaireDefinition,
} from "@quayboard/shared";
import { eq } from "drizzle-orm";

import type { AppDatabase } from "../db/client.js";
import { questionnaireAnswersTable } from "../db/schema.js";

const questionKeys = questionnaireDefinition.map((question) => question.key);

export const createQuestionnaireService = (db: AppDatabase) => ({
  getDefinition() {
    return questionnaireDefinition;
  },

  async getAnswers(projectId: string) {
    const record = await db.query.questionnaireAnswersTable.findFirst({
      where: eq(questionnaireAnswersTable.projectId, projectId),
    });

    return questionnaireAnswersSchema.parse({
      projectId,
      answers: (record?.answers ?? {}) as Record<string, string>,
      updatedAt: (record?.updatedAt ?? new Date()).toISOString(),
      completedAt: record?.completedAt?.toISOString() ?? null,
    });
  },

  async upsertAnswers(projectId: string, answers: Record<string, string>) {
    const now = new Date();
    const current = await db.query.questionnaireAnswersTable.findFirst({
      where: eq(questionnaireAnswersTable.projectId, projectId),
    });
    const mergedAnswers = questionnaireAnswerMapSchema.parse({
      ...(current?.answers ?? {}),
      ...answers,
    });
    const completed = questionKeys.every((key) => Boolean(mergedAnswers[key]?.trim()));

    if (current) {
      const [updated] = await db
        .update(questionnaireAnswersTable)
        .set({
          answers: mergedAnswers,
          updatedAt: now,
          completedAt: completed ? now : null,
        })
        .where(eq(questionnaireAnswersTable.projectId, projectId))
        .returning();

      return questionnaireAnswersSchema.parse({
        projectId,
        answers: updated.answers,
        updatedAt: updated.updatedAt.toISOString(),
        completedAt: updated.completedAt?.toISOString() ?? null,
      });
    }

    const [created] = await db
      .insert(questionnaireAnswersTable)
      .values({
        projectId,
        answers: mergedAnswers,
        updatedAt: now,
        completedAt: completed ? now : null,
      })
      .returning();

    return questionnaireAnswersSchema.parse({
      projectId,
      answers: created.answers,
      updatedAt: created.updatedAt.toISOString(),
      completedAt: created.completedAt?.toISOString() ?? null,
    });
  },
});

export type QuestionnaireService = ReturnType<typeof createQuestionnaireService>;
