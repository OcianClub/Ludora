-- CreateTable
CREATE TABLE "FpfsEvento" (
    "id" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "divisao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "hash" TEXT NOT NULL,
    "versao" INTEGER NOT NULL DEFAULT 1,
    "consultadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verificadoEm" TIMESTAMP(3),
    "diario" BOOLEAN NOT NULL DEFAULT false,
    "competicaoId" INTEGER,

    CONSTRAINT "FpfsEvento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FpfsEquipe" (
    "id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "escudo" TEXT,

    CONSTRAINT "FpfsEquipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FpfsTime" (
    "eventoId" INTEGER NOT NULL,
    "equipeId" INTEGER NOT NULL,
    "timeId" INTEGER,

    CONSTRAINT "FpfsTime_pkey" PRIMARY KEY ("eventoId","equipeId")
);

-- CreateTable
CREATE TABLE "FpfsVinculo" (
    "equipeId" INTEGER NOT NULL,
    "clubeId" INTEGER NOT NULL,
    "confirmadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,

    CONSTRAINT "FpfsVinculo_pkey" PRIMARY KEY ("equipeId")
);

-- CreateTable
CREATE TABLE "FpfsJogo" (
    "id" TEXT NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "faseId" TEXT NOT NULL,
    "sumulaId" INTEGER,
    "oficial" JSONB NOT NULL,
    "partidaId" INTEGER,

    CONSTRAINT "FpfsJogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FpfsPendencia" (
    "id" SERIAL NOT NULL,
    "jogoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ABERTA',
    "dados" JSONB NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FpfsPendencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FpfsAuditoria" (
    "id" SERIAL NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "usuarioId" INTEGER,
    "acao" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FpfsAuditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FpfsEvento_competicaoId_key" ON "FpfsEvento"("competicaoId");

-- CreateIndex
CREATE INDEX "FpfsVinculo_clubeId_idx" ON "FpfsVinculo"("clubeId");

-- CreateIndex
CREATE UNIQUE INDEX "FpfsJogo_sumulaId_key" ON "FpfsJogo"("sumulaId");

-- CreateIndex
CREATE UNIQUE INDEX "FpfsJogo_partidaId_key" ON "FpfsJogo"("partidaId");

-- CreateIndex
CREATE INDEX "FpfsJogo_eventoId_faseId_idx" ON "FpfsJogo"("eventoId", "faseId");

-- CreateIndex
CREATE UNIQUE INDEX "FpfsPendencia_jogoId_tipo_key" ON "FpfsPendencia"("jogoId", "tipo");

-- CreateIndex
CREATE INDEX "FpfsAuditoria_eventoId_criadoEm_idx" ON "FpfsAuditoria"("eventoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "FpfsEvento" ADD CONSTRAINT "FpfsEvento_competicaoId_fkey" FOREIGN KEY ("competicaoId") REFERENCES "Competicao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpfsTime" ADD CONSTRAINT "FpfsTime_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "FpfsEvento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpfsTime" ADD CONSTRAINT "FpfsTime_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "FpfsEquipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpfsTime" ADD CONSTRAINT "FpfsTime_timeId_fkey" FOREIGN KEY ("timeId") REFERENCES "Time"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpfsVinculo" ADD CONSTRAINT "FpfsVinculo_equipeId_fkey" FOREIGN KEY ("equipeId") REFERENCES "FpfsEquipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpfsVinculo" ADD CONSTRAINT "FpfsVinculo_clubeId_fkey" FOREIGN KEY ("clubeId") REFERENCES "Clube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpfsJogo" ADD CONSTRAINT "FpfsJogo_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "FpfsEvento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpfsJogo" ADD CONSTRAINT "FpfsJogo_partidaId_fkey" FOREIGN KEY ("partidaId") REFERENCES "Partida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpfsPendencia" ADD CONSTRAINT "FpfsPendencia_jogoId_fkey" FOREIGN KEY ("jogoId") REFERENCES "FpfsJogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpfsAuditoria" ADD CONSTRAINT "FpfsAuditoria_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "FpfsEvento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

