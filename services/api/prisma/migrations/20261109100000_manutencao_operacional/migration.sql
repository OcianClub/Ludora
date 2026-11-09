CREATE TABLE "Manutencao" (
  "id" TEXT PRIMARY KEY, "operacao" TEXT NOT NULL, "escopo" TEXT NOT NULL,
  "alvoId" INTEGER NOT NULL, "ativa" BOOLEAN NOT NULL DEFAULT TRUE,
  "motivo" TEXT NOT NULL, "operadorId" INTEGER NOT NULL,
  "inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revisarEm" TIMESTAMP(3) NOT NULL, "revisao" INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX "Manutencao_operacao_escopo_alvoId_key" ON "Manutencao" ("operacao", "escopo", "alvoId");
CREATE TABLE "ManutencaoHistorico" (
  "id" SERIAL PRIMARY KEY, "manutencaoId" TEXT NOT NULL,
  "operadorId" INTEGER NOT NULL, "motivo" TEXT NOT NULL,
  "antes" JSONB, "depois" JSONB NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ManutencaoHistorico_manutencaoId_fkey" FOREIGN KEY ("manutencaoId") REFERENCES "Manutencao"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "ManutencaoHistorico_manutencaoId_criadoEm_idx" ON "ManutencaoHistorico" ("manutencaoId", "criadoEm");
