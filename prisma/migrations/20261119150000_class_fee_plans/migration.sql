ALTER TABLE "FeePlan" ALTER COLUMN "programId" DROP NOT NULL;
ALTER TABLE "FeePlan" ADD COLUMN IF NOT EXISTS "classId" INTEGER;
DO $$ BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FeePlan_classId_fkey') THEN
		ALTER TABLE "FeePlan" ADD CONSTRAINT "FeePlan_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
	END IF;
END $$;
CREATE INDEX IF NOT EXISTS "FeePlan_institutionId_classId_idx" ON "FeePlan"("institutionId", "classId");
