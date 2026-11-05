-- Non-patient income (owner re-investment, training fees). Its own table rather than
-- a kind column on "Expense", so no existing expense query can pick these rows up.

-- CreateTable
CREATE TABLE "Income" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Income_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Income_date_idx" ON "Income"("date");
