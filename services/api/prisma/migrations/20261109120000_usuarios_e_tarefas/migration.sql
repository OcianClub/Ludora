ALTER TABLE "Usuario" ADD COLUMN "suspenso" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TYPE "TipoNotificacao" ADD VALUE 'CADASTRO_CLUBE';
CREATE TABLE "TarefaCadastroClube" (
 "id" TEXT PRIMARY KEY, "clubeId" INTEGER NOT NULL, "motivo" TEXT NOT NULL,
 "estado" TEXT NOT NULL DEFAULT 'PENDENTE', "mensagem" TEXT NOT NULL,
 "operadorId" INTEGER NOT NULL, "destinatarios" JSONB NOT NULL, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "encerradoEm" TIMESTAMP(3), "encerradoPor" INTEGER, "justificativa" TEXT,
 CONSTRAINT "TarefaCadastroClube_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TarefaCadastroClube_clubeId_motivo_key" ON "TarefaCadastroClube" ("clubeId", "motivo");
CREATE TABLE "AuditoriaContaInterna" (
 "id" SERIAL PRIMARY KEY, "usuarioId" INTEGER NOT NULL, "operadorId" INTEGER NOT NULL,
 "motivo" TEXT NOT NULL, "antes" JSONB NOT NULL, "depois" JSONB NOT NULL, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AuditoriaContaInterna_usuarioId_criadoEm_idx" ON "AuditoriaContaInterna" ("usuarioId", "criadoEm");
