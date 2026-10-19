-- AlterTable
ALTER TABLE "System" ADD COLUMN     "secretHash" TEXT;

-- CreateTable
CREATE TABLE "SystemCallback" (
    "id" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "nonProductionOnly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SystemCallback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HandoffCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callbackUrl" TEXT NOT NULL,
    "centralSessionId" TEXT NOT NULL,
    "correlation" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),

    CONSTRAINT "HandoffCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSession" (
    "id" TEXT NOT NULL,
    "handleHash" TEXT NOT NULL,
    "systemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "centralSessionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SystemSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SystemCallback_systemId_url_key" ON "SystemCallback"("systemId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "HandoffCode_codeHash_key" ON "HandoffCode"("codeHash");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSession_handleHash_key" ON "SystemSession"("handleHash");

-- AddForeignKey
ALTER TABLE "SystemCallback" ADD CONSTRAINT "SystemCallback_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffCode" ADD CONSTRAINT "HandoffCode_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HandoffCode" ADD CONSTRAINT "HandoffCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSession" ADD CONSTRAINT "SystemSession_systemId_fkey" FOREIGN KEY ("systemId") REFERENCES "System"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SystemSession" ADD CONSTRAINT "SystemSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
