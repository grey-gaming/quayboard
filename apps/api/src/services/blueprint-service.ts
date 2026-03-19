import { and, asc, desc, eq, inArray } from "drizzle-orm";

import {
  canonicalBlueprintsResponseSchema,
  decisionCardListResponseSchema,
  decisionCardSchema,
  type BlueprintKind,
  type DecisionCardOption,
  projectBlueprintSchema,
  updateDecisionCardsRequestSchema,
} from "@quayboard/shared";

import type { AppDatabase } from "../db/client.js";
import { decisionCardsTable, projectBlueprintsTable, projectsTable } from "../db/schema.js";
import { generateId } from "./ids.js";
import { HttpError } from "./http-error.js";

const toDecisionCard = (record: typeof decisionCardsTable.$inferSelect) =>
  decisionCardSchema.parse({
    id: record.id,
    projectId: record.projectId,
    key: record.key,
    category: record.category,
    title: record.title,
    prompt: record.prompt,
    recommendation: record.recommendation as DecisionCardOption,
    alternatives: record.alternatives as DecisionCardOption[],
    selectedOptionId: record.selectedOptionId,
    customSelection: record.customSelection,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  });

const toProjectBlueprint = (record: typeof projectBlueprintsTable.$inferSelect) =>
  projectBlueprintSchema.parse({
    id: record.id,
    projectId: record.projectId,
    kind: record.kind,
    version: record.version,
    title: record.title,
    markdown: record.markdown,
    source: record.source,
    isCanonical: record.isCanonical,
    createdAt: record.createdAt.toISOString(),
  });

export const createBlueprintService = (db: AppDatabase) => ({
  async assertOwnedProject(ownerUserId: string, projectId: string) {
    const project = await db.query.projectsTable.findFirst({
      where: and(eq(projectsTable.id, projectId), eq(projectsTable.ownerUserId, ownerUserId)),
    });

    if (!project) {
      throw new HttpError(404, "project_not_found", "Project not found.");
    }

    return project;
  },

  async listDecisionCards(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);

    const cards = await db.query.decisionCardsTable.findMany({
      where: eq(decisionCardsTable.projectId, projectId),
      orderBy: [asc(decisionCardsTable.createdAt)],
    });

    return decisionCardListResponseSchema.parse({
      cards: cards.map(toDecisionCard),
    });
  },

  async replaceDecisionDeck(input: {
    cards: Array<{
      key: string;
      category: string;
      title: string;
      prompt: string;
      recommendation: DecisionCardOption;
      alternatives: DecisionCardOption[];
    }>;
    jobId?: string;
    projectId: string;
  }) {
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx.delete(decisionCardsTable).where(eq(decisionCardsTable.projectId, input.projectId));
      await tx
        .update(projectBlueprintsTable)
        .set({ isCanonical: false })
        .where(eq(projectBlueprintsTable.projectId, input.projectId));

      if (input.cards.length === 0) {
        return;
      }

      await tx.insert(decisionCardsTable).values(
        input.cards.map((card) => ({
          id: generateId(),
          projectId: input.projectId,
          key: card.key,
          category: card.category,
          title: card.title,
          prompt: card.prompt,
          recommendation: card.recommendation,
          alternatives: card.alternatives,
          selectedOptionId: null,
          customSelection: null,
          createdByJobId: input.jobId ?? null,
          createdAt: now,
          updatedAt: now,
        })),
      );
    });

    const cards = await db.query.decisionCardsTable.findMany({
      where: eq(decisionCardsTable.projectId, input.projectId),
      orderBy: [asc(decisionCardsTable.createdAt)],
    });

    return cards.map(toDecisionCard);
  },

  async updateDecisionCards(ownerUserId: string, projectId: string, input: unknown) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const payload = updateDecisionCardsRequestSchema.parse(input);
    const ids = payload.cards.map((card) => card.id);
    const existingCards = await db.query.decisionCardsTable.findMany({
      where: and(eq(decisionCardsTable.projectId, projectId), inArray(decisionCardsTable.id, ids)),
    });

    if (existingCards.length !== ids.length) {
      throw new HttpError(404, "decision_card_not_found", "Decision card not found.");
    }

    const optionIdByCard = new Map(
      existingCards.map((card) => [
        card.id,
        new Set(
          ((card.alternatives as DecisionCardOption[]) ?? [])
            .map((option) => option.id)
            .concat((card.recommendation as DecisionCardOption).id),
        ),
      ]),
    );

    await db.transaction(async (tx) => {
      await tx
        .update(projectBlueprintsTable)
        .set({ isCanonical: false })
        .where(eq(projectBlueprintsTable.projectId, projectId));

      for (const update of payload.cards) {
        if (update.selectedOptionId) {
          const optionIds = optionIdByCard.get(update.id);
          if (!optionIds?.has(update.selectedOptionId)) {
            throw new HttpError(
              400,
              "invalid_decision_selection",
              "Selected decision option is not valid for this card.",
            );
          }
        }

        await tx
          .update(decisionCardsTable)
          .set({
            selectedOptionId: update.customSelection ? null : (update.selectedOptionId ?? null),
            customSelection: update.customSelection ?? null,
            updatedAt: new Date(),
          })
          .where(eq(decisionCardsTable.id, update.id));
      }
    });

    return this.listDecisionCards(ownerUserId, projectId);
  },

  async getDecisionSelections(ownerUserId: string, projectId: string) {
    const { cards } = await this.listDecisionCards(ownerUserId, projectId);

    return cards.map((card) => {
      const selectedOption = card.selectedOptionId
        ? [card.recommendation, ...card.alternatives].find((option) => option.id === card.selectedOptionId)
        : null;

      return {
        key: card.key,
        title: card.title,
        category: card.category,
        selection: card.customSelection ?? selectedOption?.label ?? null,
        rationale: card.customSelection ? "Custom user selection" : selectedOption?.description ?? null,
      };
    });
  },

  async assertFullySelectedDecisionDeck(ownerUserId: string, projectId: string) {
    const selections = await this.getDecisionSelections(ownerUserId, projectId);

    if (selections.length === 0) {
      throw new HttpError(
        409,
        "decision_deck_required",
        "Generate the decision deck before creating blueprints.",
      );
    }

    if (selections.some((selection) => !selection.selection)) {
      throw new HttpError(
        409,
        "decision_selection_required",
        "Select an option for every decision card before generating blueprints.",
      );
    }

    return selections;
  },

  async getCanonicalRecord(projectId: string, kind: BlueprintKind) {
    return db.query.projectBlueprintsTable.findFirst({
      where: and(
        eq(projectBlueprintsTable.projectId, projectId),
        eq(projectBlueprintsTable.kind, kind),
        eq(projectBlueprintsTable.isCanonical, true),
      ),
      orderBy: [desc(projectBlueprintsTable.version)],
    });
  },

  async getCanonical(ownerUserId: string, projectId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const [uxBlueprint, techBlueprint] = await Promise.all([
      this.getCanonicalRecord(projectId, "ux"),
      this.getCanonicalRecord(projectId, "tech"),
    ]);

    return canonicalBlueprintsResponseSchema.parse({
      uxBlueprint: uxBlueprint ? toProjectBlueprint(uxBlueprint) : null,
      techBlueprint: techBlueprint ? toProjectBlueprint(techBlueprint) : null,
    });
  },

  async createBlueprintVersion(input: {
    jobId?: string;
    kind: BlueprintKind;
    markdown: string;
    projectId: string;
    source: string;
    title: string;
  }) {
    const latest = await db.query.projectBlueprintsTable.findFirst({
      where: and(
        eq(projectBlueprintsTable.projectId, input.projectId),
        eq(projectBlueprintsTable.kind, input.kind),
      ),
      orderBy: [desc(projectBlueprintsTable.version)],
    });
    const version = (latest?.version ?? 0) + 1;
    const now = new Date();

    await db
      .update(projectBlueprintsTable)
      .set({ isCanonical: false })
      .where(
        and(
          eq(projectBlueprintsTable.projectId, input.projectId),
          eq(projectBlueprintsTable.kind, input.kind),
        ),
      );

    const [created] = await db
      .insert(projectBlueprintsTable)
      .values({
        id: generateId(),
        projectId: input.projectId,
        kind: input.kind,
        version,
        title: input.title,
        markdown: input.markdown,
        source: input.source,
        isCanonical: true,
        createdByJobId: input.jobId ?? null,
        createdAt: now,
      })
      .returning();

    return toProjectBlueprint(created);
  },

  async assertCanonicalBlueprint(ownerUserId: string, projectId: string, kind: BlueprintKind, blueprintId: string) {
    await this.assertOwnedProject(ownerUserId, projectId);
    const canonical = await this.getCanonicalRecord(projectId, kind);

    if (!canonical || canonical.id !== blueprintId) {
      throw new HttpError(404, "blueprint_not_found", "Blueprint not found.");
    }

    return canonical;
  },
});

export type BlueprintService = ReturnType<typeof createBlueprintService>;
