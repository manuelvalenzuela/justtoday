-- CreateTable
CREATE TABLE "PlanRefinementChat" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "messages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanRefinementChat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlanRefinementChat_planId_idx" ON "PlanRefinementChat"("planId");

-- AddForeignKey
ALTER TABLE "PlanRefinementChat" ADD CONSTRAINT "PlanRefinementChat_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
