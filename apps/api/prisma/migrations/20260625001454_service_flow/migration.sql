-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "defaultRequiresPreparation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "defaultStation" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "course" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "firedAt" TIMESTAMP(3),
ADD COLUMN     "requiresPrep" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "requiresPreparation" BOOLEAN NOT NULL DEFAULT true;
