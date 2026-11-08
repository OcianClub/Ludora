CREATE TYPE "OpcaoPalpite" AS ENUM ('MANDANTE', 'EMPATE', 'VISITANTE');
ALTER TABLE "Partida" ADD COLUMN "palpites_versao" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "VotoPartida" (
  "partida_id" INTEGER NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "escolha" "OpcaoPalpite" NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VotoPartida_pkey" PRIMARY KEY ("partida_id", "usuario_id"),
  CONSTRAINT "VotoPartida_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "Partida"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VotoPartida_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VotoPartida_partida_id_escolha_idx" ON "VotoPartida"("partida_id", "escolha");
