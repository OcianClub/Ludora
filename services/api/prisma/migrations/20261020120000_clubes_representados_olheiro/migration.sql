ALTER TYPE "PapelUsuario" ADD VALUE IF NOT EXISTS 'OLHEIRO';
ALTER TABLE "Time" ADD COLUMN "clube_representado_id" INTEGER;
ALTER TABLE "Time" ADD CONSTRAINT "Time_clube_representado_id_fkey" FOREIGN KEY ("clube_representado_id") REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Time_clube_representado_id_idx" ON "Time"("clube_representado_id");
CREATE TABLE "AuditoriaVinculoTime" (
  "id" SERIAL PRIMARY KEY,
  "time_id" INTEGER NOT NULL,
  "clube_anterior_id" INTEGER,
  "clube_novo_id" INTEGER,
  "usuario_id" INTEGER,
  "motivo" TEXT NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditoriaVinculoTime_time_id_idx" ON "AuditoriaVinculoTime"("time_id");
