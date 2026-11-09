CREATE TABLE "SuporteChamado" (
  "id" TEXT PRIMARY KEY, "requestId" TEXT NOT NULL UNIQUE,
  "origem" TEXT NOT NULL, "assunto" TEXT NOT NULL, "descricao" TEXT NOT NULL,
  "impacto" TEXT NOT NULL, "tipo" TEXT NOT NULL, "prioridade" TEXT NOT NULL,
  "fila" TEXT NOT NULL, "regra" TEXT NOT NULL, "restrito" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'NOVO', "clubeId" INTEGER REFERENCES "Clube"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "usuarioId" INTEGER REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "responsavelId" INTEGER, "rota" TEXT NOT NULL, "servico" TEXT NOT NULL, "versao" TEXT NOT NULL,
  "fingerprint" TEXT UNIQUE, "ocorrencias" INTEGER NOT NULL DEFAULT 1,
  "clubesAfetados" JSONB NOT NULL DEFAULT '[]', "detalhesTecnicos" JSONB,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL, "revisarEm" TIMESTAMP(3) NOT NULL, "revisao" INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "SuporteChamado_fila_status_criadoEm_idx" ON "SuporteChamado"("fila", "status", "criadoEm");
CREATE INDEX "SuporteChamado_clubeId_usuarioId_idx" ON "SuporteChamado"("clubeId", "usuarioId");
CREATE TABLE "SuporteHistorico" (
  "id" SERIAL PRIMARY KEY, "chamadoId" TEXT NOT NULL REFERENCES "SuporteChamado"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "operadorId" INTEGER, "acao" TEXT NOT NULL, "motivo" TEXT NOT NULL, "publico" BOOLEAN NOT NULL DEFAULT false,
  "dados" JSONB, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SuporteHistorico_chamadoId_criadoEm_idx" ON "SuporteHistorico"("chamadoId", "criadoEm");
