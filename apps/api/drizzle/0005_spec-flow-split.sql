ALTER TABLE "decision_cards" ADD COLUMN "kind" text;
ALTER TABLE "decision_cards" ADD COLUMN "accepted_at" timestamp with time zone;

UPDATE "decision_cards" SET "kind" = 'ux' WHERE "kind" IS NULL;

ALTER TABLE "decision_cards" ALTER COLUMN "kind" SET NOT NULL;
ALTER TABLE "decision_cards"
  ADD CONSTRAINT "decision_cards_kind_check" CHECK ("kind" in ('ux', 'tech'));

DROP INDEX "decision_cards_project_id_key";
CREATE INDEX "decision_cards_project_id_kind_idx" ON "decision_cards" USING btree ("project_id", "kind");
CREATE UNIQUE INDEX "decision_cards_project_id_kind_key"
  ON "decision_cards" USING btree ("project_id", "kind", "key");
