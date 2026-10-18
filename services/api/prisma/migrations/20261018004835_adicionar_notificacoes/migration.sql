-- CreateEnum
CREATE TYPE "TipoNotificacao" AS ENUM ('PARTIDA_AGENDADA', 'GOL_PARTIDA', 'RESULTADO_PARTIDA');

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "notificacoes_ativas" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Notificacao" (
    "id" SERIAL NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "clube_id" INTEGER NOT NULL,
    "partida_id" INTEGER,
    "tipo" "TipoNotificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "dados" JSONB,
    "lida" BOOLEAN NOT NULL DEFAULT false,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DispositivoPush" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" TEXT,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DispositivoPush_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notificacao_usuario_id_clube_id_lida_idx" ON "Notificacao"("usuario_id", "clube_id", "lida");

-- CreateIndex
CREATE INDEX "Notificacao_partida_id_idx" ON "Notificacao"("partida_id");

-- CreateIndex
CREATE INDEX "Notificacao_criada_em_idx" ON "Notificacao"("criada_em");

-- CreateIndex
CREATE UNIQUE INDEX "DispositivoPush_token_key" ON "DispositivoPush"("token");

-- CreateIndex
CREATE INDEX "DispositivoPush_usuario_id_idx" ON "DispositivoPush"("usuario_id");

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_clube_id_fkey" FOREIGN KEY ("clube_id") REFERENCES "Clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notificacao" ADD CONSTRAINT "Notificacao_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "Partida"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DispositivoPush" ADD CONSTRAINT "DispositivoPush_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
