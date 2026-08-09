-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "StatusPartida" AS ENUM ('AGENDADA', 'AO_VIVO', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('GOL', 'ASSISTENCIA', 'DESARME', 'CARTAO_AMARELO', 'CARTAO_VERMELHO');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jogador" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "posicao" TEXT NOT NULL,
    "categoria_id" INTEGER NOT NULL,
    "perfil_ml" TEXT,

    CONSTRAINT "Jogador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Partida" (
    "id" SERIAL NOT NULL,
    "adversario" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "StatusPartida" NOT NULL DEFAULT 'AGENDADA',

    CONSTRAINT "Partida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" SERIAL NOT NULL,
    "partida_id" INTEGER NOT NULL,
    "jogador_id" INTEGER NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "minuto" INTEGER NOT NULL,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "Partida"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "Jogador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
