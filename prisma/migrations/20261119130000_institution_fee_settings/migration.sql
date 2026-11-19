CREATE TABLE "InstitutionFeeSettings" (
    "id" TEXT NOT NULL,
    "institutionId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "merchantName" TEXT NOT NULL DEFAULT '',
    "merchantPhone" TEXT NOT NULL DEFAULT '',
    "bankName" TEXT NOT NULL DEFAULT '',
    "bankAccountName" TEXT NOT NULL DEFAULT '',
    "bankAccountNumber" TEXT NOT NULL DEFAULT '',
    "khaltiSecretEncrypted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstitutionFeeSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InstitutionFeeSettings_institutionId_key" UNIQUE ("institutionId"),
    CONSTRAINT "InstitutionFeeSettings_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE
);