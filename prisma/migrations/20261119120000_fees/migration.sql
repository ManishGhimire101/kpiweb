ALTER TABLE "StudentProfile"
ADD COLUMN "programId" INTEGER,
ADD COLUMN "courseId" INTEGER;

CREATE TABLE "FeePlan" (
    "id" SERIAL NOT NULL,
    "institutionId" INTEGER NOT NULL,
    "programId" INTEGER NOT NULL,
    "courseId" INTEGER,
    "name" TEXT NOT NULL,
    "cycle" TEXT NOT NULL DEFAULT 'TERM',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FeePlan_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeePlan_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeePlan_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeePlan_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "FeePlanItem" (
    "id" SERIAL NOT NULL,
    "planId" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "FeePlanItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeePlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FeePlan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "FeeBill" (
    "id" SERIAL NOT NULL,
    "institutionId" INTEGER NOT NULL,
    "studentId" INTEGER NOT NULL,
    "planId" INTEGER,
    "title" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "lines" JSONB NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeeBill_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeeBill_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeeBill_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FeeBill_planId_fkey" FOREIGN KEY ("planId") REFERENCES "FeePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "FeePayment" (
    "id" SERIAL NOT NULL,
    "billId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "method" TEXT NOT NULL,
    "khaltiPidx" TEXT,
    "khaltiTransactionId" TEXT,
    "receivedByUserId" INTEGER,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeePayment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FeePayment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "FeeBill"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FeePayment_khaltiPidx_key" ON "FeePayment"("khaltiPidx");
CREATE INDEX "FeePlan_institutionId_programId_idx" ON "FeePlan"("institutionId", "programId");
CREATE UNIQUE INDEX "FeePlan_institutionId_name_programId_courseId_key" ON "FeePlan"("institutionId", "name", "programId", "courseId");
CREATE INDEX "FeePlanItem_planId_idx" ON "FeePlanItem"("planId");
CREATE INDEX "FeeBill_institutionId_studentId_createdAt_idx" ON "FeeBill"("institutionId", "studentId", "createdAt");
CREATE UNIQUE INDEX "FeeBill_studentId_planId_academicYear_period_key" ON "FeeBill"("studentId", "planId", "academicYear", "period");
CREATE INDEX "FeePayment_billId_status_idx" ON "FeePayment"("billId", "status");
CREATE INDEX "StudentProfile_programId_idx" ON "StudentProfile"("programId");
CREATE INDEX "StudentProfile_courseId_idx" ON "StudentProfile"("courseId");
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;