-- CreateTable
CREATE TABLE "DayConversation" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "messages" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayConversation_planId_idx" ON "DayConversation"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "DayConversation_planId_dayNumber_key" ON "DayConversation"("planId", "dayNumber");

-- AddForeignKey
ALTER TABLE "DayConversation" ADD CONSTRAINT "DayConversation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
