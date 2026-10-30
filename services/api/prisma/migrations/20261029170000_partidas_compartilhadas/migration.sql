-- DropIndex
DROP INDEX "EscalacaoPartida_partida_id_numCamisa_key";

-- AlterTable
ALTER TABLE "Competicao" ADD COLUMN     "arquivada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exigir_inscricao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "titulares_necessarios" INTEGER NOT NULL DEFAULT 5;

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "criado_por_id" INTEGER,
ADD COLUMN     "gol_contra" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "time_id" INTEGER;

-- AlterTable
ALTER TABLE "Partida" ADD COLUMN     "organizador_id" INTEGER,
ADD COLUMN     "periodo_atual" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sumula_clube_id" INTEGER,
ADD COLUMN     "titulares_necessarios" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "versao" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EscalacaoPartida" ADD COLUMN     "ordem" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "time_id" INTEGER,
ADD COLUMN     "titular_inicial" BOOLEAN;

-- CreateTable
CREATE TABLE "ParticipantePartida" (
    "id" SERIAL NOT NULL,
    "partida_id" INTEGER NOT NULL,
    "clube_id" INTEGER NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "time_id" INTEGER NOT NULL,
    "pronta" BOOLEAN NOT NULL DEFAULT false,
    "publicada_em" TIMESTAMP(3),
    "versao" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ParticipantePartida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropostaPartida" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'CRIACAO',
    "origem_id" INTEGER NOT NULL,
    "destino_id" INTEGER NOT NULL,
    "respondente_id" INTEGER NOT NULL,
    "categoria_origem_id" INTEGER NOT NULL,
    "categoria_destino_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "chave" TEXT,
    "dados" JSONB NOT NULL,
    "motivo" TEXT,
    "versao" INTEGER NOT NULL DEFAULT 0,
    "partida_id" INTEGER,
    "criado_por_id" INTEGER NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondido_em" TIMESTAMP(3),

    CONSTRAINT "PropostaPartida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditoriaPartida" (
    "id" SERIAL NOT NULL,
    "partida_id" INTEGER NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "clube_id" INTEGER NOT NULL,
    "acao" TEXT NOT NULL,
    "dados" JSONB,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditoriaPartida_pkey" PRIMARY KEY ("id")
);

UPDATE "Partida" p SET organizador_id = c.clube_id, sumula_clube_id = c.clube_id FROM "Categoria" c WHERE c.id = p.categoria_id;
UPDATE "EscalacaoPartida" e SET time_id = CASE WHEN p."emCasa" THEN p.mandante_id ELSE p.visitante_id END FROM "Partida" p WHERE p.id = e.partida_id;
WITH ordenadas AS (SELECT id, ROW_NUMBER() OVER (PARTITION BY partida_id ORDER BY titular DESC, "numCamisa", id) - 1 AS ordem FROM "EscalacaoPartida")
UPDATE "EscalacaoPartida" e SET ordem = o.ordem, titular_inicial = e.titular FROM ordenadas o WHERE o.id = e.id;
ALTER TABLE "EscalacaoPartida" ALTER COLUMN time_id SET NOT NULL;
INSERT INTO "ParticipantePartida" (partida_id, clube_id, categoria_id, time_id, pronta, publicada_em)
SELECT p.id, c.clube_id, c.id, CASE WHEN p."emCasa" THEN p.mandante_id ELSE p.visitante_id END,
 p.status IN ('PREPARADA','AO_VIVO','FINALIZADA'), CASE WHEN p.status IN ('PREPARADA','AO_VIVO','FINALIZADA') THEN NOW() ELSE NULL END
FROM "Partida" p JOIN "Categoria" c ON c.id = p.categoria_id;

-- CreateIndex
CREATE INDEX "ParticipantePartida_categoria_id_idx" ON "ParticipantePartida"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantePartida_partida_id_clube_id_key" ON "ParticipantePartida"("partida_id", "clube_id");

-- CreateIndex
CREATE UNIQUE INDEX "ParticipantePartida_partida_id_time_id_key" ON "ParticipantePartida"("partida_id", "time_id");

-- CreateIndex
CREATE UNIQUE INDEX "PropostaPartida_chave_key" ON "PropostaPartida"("chave");

-- CreateIndex
CREATE INDEX "PropostaPartida_destino_id_status_idx" ON "PropostaPartida"("destino_id", "status");

-- CreateIndex
CREATE INDEX "PropostaPartida_origem_id_status_idx" ON "PropostaPartida"("origem_id", "status");

-- CreateIndex
CREATE INDEX "AuditoriaPartida_partida_id_criado_em_idx" ON "AuditoriaPartida"("partida_id", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "EscalacaoPartida_partida_id_time_id_numCamisa_key" ON "EscalacaoPartida"("partida_id", "time_id", "numCamisa");

-- AddForeignKey
ALTER TABLE "ParticipantePartida" ADD CONSTRAINT "ParticipantePartida_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "Partida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantePartida" ADD CONSTRAINT "ParticipantePartida_clube_id_fkey" FOREIGN KEY ("clube_id") REFERENCES "Clube"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantePartida" ADD CONSTRAINT "ParticipantePartida_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParticipantePartida" ADD CONSTRAINT "ParticipantePartida_time_id_fkey" FOREIGN KEY ("time_id") REFERENCES "Time"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropostaPartida" ADD CONSTRAINT "PropostaPartida_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "Partida"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditoriaPartida" ADD CONSTRAINT "AuditoriaPartida_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "Partida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

