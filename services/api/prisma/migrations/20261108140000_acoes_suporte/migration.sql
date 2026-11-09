CREATE TABLE "SuporteAcao" (
 "requestId" TEXT PRIMARY KEY, "chamadoId" TEXT NOT NULL REFERENCES "SuporteChamado"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "operadorId" INTEGER NOT NULL, "tipo" TEXT NOT NULL, "alvo" TEXT NOT NULL,
 "resultado" TEXT NOT NULL DEFAULT 'EM_EXECUCAO', "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "SuporteAcao_alvo_criadoEm_idx" ON "SuporteAcao"("alvo", "criadoEm");
CREATE TABLE "RecuperacaoExcepcional" (
 "id" TEXT PRIMARY KEY, "chamadoId" TEXT NOT NULL REFERENCES "SuporteChamado"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "usuarioId" INTEGER NOT NULL, "solicitanteId" INTEGER NOT NULL, "aprovadorId" INTEGER,
 "emailAnterior" TEXT NOT NULL, "novoEmail" TEXT NOT NULL, "justificativa" TEXT NOT NULL, "verificacao" TEXT,
 "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_APROVACAO', "tokenHash" TEXT UNIQUE, "expiraEm" TIMESTAMP(3),
 "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "atualizadoEm" TIMESTAMP(3) NOT NULL
);
