/*
  Warnings:

  - A unique constraint covering the columns `[codigo_hash]` on the table `ConviteClube` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ConviteClube" ADD COLUMN     "codigo_hash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ConviteClube_codigo_hash_key" ON "ConviteClube"("codigo_hash");
