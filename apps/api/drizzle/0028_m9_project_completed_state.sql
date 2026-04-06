ALTER TABLE "projects" DROP CONSTRAINT "projects_state_check";

ALTER TABLE "projects" ADD CONSTRAINT "projects_state_check"
CHECK ("state" IN ('EMPTY', 'BOOTSTRAPPING', 'IMPORTING_A', 'IMPORTING_B', 'READY_PARTIAL', 'READY', 'COMPLETED'));
