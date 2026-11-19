CREATE TYPE "StudentTransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

CREATE TABLE "StudentTransferRequest" (
    "id" SERIAL NOT NULL,
    "studentId" INTEGER NOT NULL,
    "sourceInstitutionId" INTEGER NOT NULL,
    "destinationInstitutionId" INTEGER NOT NULL,
    "requestedByUserId" INTEGER NOT NULL,
    "status" "StudentTransferStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "responseNote" TEXT,
    "historyArchive" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    CONSTRAINT "StudentTransferRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentTransferRequest_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentTransferRequest_sourceInstitutionId_fkey" FOREIGN KEY ("sourceInstitutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentTransferRequest_destinationInstitutionId_fkey" FOREIGN KEY ("destinationInstitutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudentTransferRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "StudentTransferRequest_destinationInstitutionId_status_idx" ON "StudentTransferRequest"("destinationInstitutionId", "status");
CREATE INDEX "StudentTransferRequest_sourceInstitutionId_status_idx" ON "StudentTransferRequest"("sourceInstitutionId", "status");
