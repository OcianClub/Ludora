/*
  Warnings:

  - The values [DESARME] on the enum `TipoEvento` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `adversario` on the `Partida` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `Usuario` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[cpf]` on the table `Jogador` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `periodo` to the `Evento` table without a default value. This is not possible if the table is not empty.
  - Added the required column `cpf` to the `Jogador` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dtNasc` to the `Jogador` table without a default value. This is not possible if the table is not empty.
  - Added the required column `categoria_id` to the `Partida` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mandante_id` to the `Partida` table without a default value. This is not possible if the table is not empty.
  - Added the required column `visitante_id` to the `Partida` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nome` to the `Usuario` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('ADMIN', 'MESARIO', 'TECNICO', 'TORCEDOR');

-- CreateEnum
CREATE TYPE "TipoCategoria" AS ENUM ('INICIACAO', 'BASE');

-- CreateEnum
CREATE TYPE "TipoCompeticao" AS ENUM ('INICIACAO', 'BASE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "StatusPartida" ADD VALUE 'PREPARADA';
ALTER TYPE "StatusPartida" ADD VALUE 'CANCELADA';

-- AlterEnum
BEGIN;
CREATE TYPE "TipoEvento_new" AS ENUM ('GOL', 'ASSISTENCIA', 'DEFESA', 'CARTAO_AMARELO', 'CARTAO_VERMELHO', 'CARTAO_AZUL', 'FALTA');
ALTER TABLE "Evento" ALTER COLUMN "tipo" TYPE "TipoEvento_new" USING ("tipo"::text::"TipoEvento_new");
ALTER TYPE "TipoEvento" RENAME TO "TipoEvento_old";
ALTER TYPE "TipoEvento_new" RENAME TO "TipoEvento";
DROP TYPE "TipoEvento_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Evento" DROP CONSTRAINT "Evento_jogador_id_fkey";

-- DropForeignKey
ALTER TABLE "Evento" DROP CONSTRAINT "Evento_partida_id_fkey";

-- AlterTable
ALTER TABLE "Evento" ADD COLUMN     "periodo" INTEGER NOT NULL,
ALTER COLUMN "jogador_id" DROP NOT NULL,
ALTER COLUMN "minuto" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Jogador" ADD COLUMN     "ativo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "cpf" TEXT NOT NULL,
ADD COLUMN     "dtNasc" DATE NOT NULL,
ADD COLUMN     "nota_geral" DOUBLE PRECISION,
ADD COLUMN     "numCamisa" INTEGER,
ADD COLUMN     "scores_ml" JSONB;

-- AlterTable
ALTER TABLE "Partida" DROP COLUMN "adversario",
ADD COLUMN     "categoria_id" INTEGER NOT NULL,
ADD COLUMN     "competicao_id" INTEGER,
ADD COLUMN     "emCasa" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "gols_mandante" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gols_visitante" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "grupo" TEXT,
ADD COLUMN     "horario" TEXT,
ADD COLUMN     "local" TEXT,
ADD COLUMN     "mandante_id" INTEGER NOT NULL,
ADD COLUMN     "rodada" INTEGER,
ADD COLUMN     "visitante_id" INTEGER NOT NULL,
ALTER COLUMN "data" DROP DEFAULT,
ALTER COLUMN "data" SET DATA TYPE DATE;

-- AlterTable
ALTER TABLE "Usuario" DROP COLUMN "role",
ADD COLUMN     "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "nome" TEXT NOT NULL;

-- DropEnum
DROP TYPE "Role";

-- CreateTable
CREATE TABLE "Clube" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "escudo" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "plano" TEXT NOT NULL DEFAULT 'FREE',
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Clube_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsuarioClube" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "clube_id" INTEGER NOT NULL,
    "papel" "PapelUsuario" NOT NULL DEFAULT 'TORCEDOR',

    CONSTRAINT "UsuarioClube_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" SERIAL NOT NULL,
    "clube_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "faixaIdade" INTEGER NOT NULL DEFAULT 0,
    "tipo" "TipoCategoria" NOT NULL,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competicao" (
    "id" SERIAL NOT NULL,
    "clube_id" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "tipo" "TipoCompeticao" NOT NULL,

    CONSTRAINT "Competicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Time" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "escudo" TEXT,
    "categoria_id" INTEGER,

    CONSTRAINT "Time_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompeticaoTime" (
    "id" SERIAL NOT NULL,
    "competicao_id" INTEGER NOT NULL,
    "time_id" INTEGER NOT NULL,

    CONSTRAINT "CompeticaoTime_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompeticaoJogador" (
    "id" SERIAL NOT NULL,
    "competicao_id" INTEGER NOT NULL,
    "jogador_id" INTEGER NOT NULL,
    "inscritoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompeticaoJogador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EscalacaoPartida" (
    "id" SERIAL NOT NULL,
    "partida_id" INTEGER NOT NULL,
    "jogador_id" INTEGER NOT NULL,
    "numCamisa" INTEGER NOT NULL,
    "titular" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "EscalacaoPartida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampeonatoClassificacao" (
    "id" SERIAL NOT NULL,
    "temporada" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "divisao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "eventoId" INTEGER NOT NULL,
    "tipoTabela" TEXT NOT NULL,
    "grupo" TEXT NOT NULL,
    "posicao" INTEGER NOT NULL,
    "clube" TEXT NOT NULL,
    "pontos" INTEGER NOT NULL,
    "jogos" INTEGER NOT NULL,
    "vitorias" INTEGER NOT NULL,
    "empates" INTEGER NOT NULL,
    "derrotas" INTEGER NOT NULL,
    "golsPro" INTEGER NOT NULL,
    "golsContra" INTEGER NOT NULL,
    "saldo" INTEGER NOT NULL,
    "average" DOUBLE PRECISION NOT NULL,
    "mediaGolsMarcados" DOUBLE PRECISION NOT NULL,
    "mediaGolsSofridos" DOUBLE PRECISION NOT NULL,
    "indiceTecnico" DOUBLE PRECISION NOT NULL,
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampeonatoClassificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_CompeticaoCategorias" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE INDEX "UsuarioClube_clube_id_idx" ON "UsuarioClube"("clube_id");

-- CreateIndex
CREATE UNIQUE INDEX "UsuarioClube_usuario_id_clube_id_key" ON "UsuarioClube"("usuario_id", "clube_id");

-- CreateIndex
CREATE INDEX "Categoria_clube_id_idx" ON "Categoria"("clube_id");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_nome_clube_id_key" ON "Categoria"("nome", "clube_id");

-- CreateIndex
CREATE INDEX "Competicao_clube_id_idx" ON "Competicao"("clube_id");

-- CreateIndex
CREATE INDEX "Time_categoria_id_idx" ON "Time"("categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "Time_nome_categoria_id_key" ON "Time"("nome", "categoria_id");

-- CreateIndex
CREATE UNIQUE INDEX "CompeticaoTime_competicao_id_time_id_key" ON "CompeticaoTime"("competicao_id", "time_id");

-- CreateIndex
CREATE INDEX "CompeticaoJogador_competicao_id_idx" ON "CompeticaoJogador"("competicao_id");

-- CreateIndex
CREATE UNIQUE INDEX "CompeticaoJogador_competicao_id_jogador_id_key" ON "CompeticaoJogador"("competicao_id", "jogador_id");

-- CreateIndex
CREATE UNIQUE INDEX "EscalacaoPartida_partida_id_jogador_id_key" ON "EscalacaoPartida"("partida_id", "jogador_id");

-- CreateIndex
CREATE UNIQUE INDEX "EscalacaoPartida_partida_id_numCamisa_key" ON "EscalacaoPartida"("partida_id", "numCamisa");

-- CreateIndex
CREATE INDEX "CampeonatoClassificacao_temporada_titulo_divisao_categoria__idx" ON "CampeonatoClassificacao"("temporada", "titulo", "divisao", "categoria", "tipoTabela");

-- CreateIndex
CREATE UNIQUE INDEX "_CompeticaoCategorias_AB_unique" ON "_CompeticaoCategorias"("A", "B");

-- CreateIndex
CREATE INDEX "_CompeticaoCategorias_B_index" ON "_CompeticaoCategorias"("B");

-- CreateIndex
CREATE INDEX "Evento_partida_id_idx" ON "Evento"("partida_id");

-- CreateIndex
CREATE UNIQUE INDEX "Jogador_cpf_key" ON "Jogador"("cpf");

-- CreateIndex
CREATE INDEX "Jogador_categoria_id_idx" ON "Jogador"("categoria_id");

-- CreateIndex
CREATE INDEX "Partida_data_idx" ON "Partida"("data");

-- CreateIndex
CREATE INDEX "Partida_categoria_id_idx" ON "Partida"("categoria_id");

-- CreateIndex
CREATE INDEX "Partida_competicao_id_idx" ON "Partida"("competicao_id");

-- AddForeignKey
ALTER TABLE "UsuarioClube" ADD CONSTRAINT "UsuarioClube_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioClube" ADD CONSTRAINT "UsuarioClube_clube_id_fkey" FOREIGN KEY ("clube_id") REFERENCES "Clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_clube_id_fkey" FOREIGN KEY ("clube_id") REFERENCES "Clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competicao" ADD CONSTRAINT "Competicao_clube_id_fkey" FOREIGN KEY ("clube_id") REFERENCES "Clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "Jogador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "Partida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Time" ADD CONSTRAINT "Time_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Jogador" ADD CONSTRAINT "Jogador_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_competicao_id_fkey" FOREIGN KEY ("competicao_id") REFERENCES "Competicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_mandante_id_fkey" FOREIGN KEY ("mandante_id") REFERENCES "Time"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partida" ADD CONSTRAINT "Partida_visitante_id_fkey" FOREIGN KEY ("visitante_id") REFERENCES "Time"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompeticaoTime" ADD CONSTRAINT "CompeticaoTime_competicao_id_fkey" FOREIGN KEY ("competicao_id") REFERENCES "Competicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompeticaoTime" ADD CONSTRAINT "CompeticaoTime_time_id_fkey" FOREIGN KEY ("time_id") REFERENCES "Time"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompeticaoJogador" ADD CONSTRAINT "CompeticaoJogador_competicao_id_fkey" FOREIGN KEY ("competicao_id") REFERENCES "Competicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompeticaoJogador" ADD CONSTRAINT "CompeticaoJogador_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "Jogador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalacaoPartida" ADD CONSTRAINT "EscalacaoPartida_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "Jogador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EscalacaoPartida" ADD CONSTRAINT "EscalacaoPartida_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "Partida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompeticaoCategorias" ADD CONSTRAINT "_CompeticaoCategorias_A_fkey" FOREIGN KEY ("A") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CompeticaoCategorias" ADD CONSTRAINT "_CompeticaoCategorias_B_fkey" FOREIGN KEY ("B") REFERENCES "Competicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;
