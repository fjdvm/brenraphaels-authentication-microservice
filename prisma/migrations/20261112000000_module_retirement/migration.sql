-- Expand before deploying readers that filter retired Modules. The HRMS data
-- cutover runs only after the legacy hiring compatibility code is deployed.
ALTER TABLE "Module" ADD COLUMN "retiredAt" TIMESTAMP(3);
