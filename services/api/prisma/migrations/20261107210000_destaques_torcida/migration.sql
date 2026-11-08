CREATE TABLE "VotacaoDestaquePartida" (
  "partida_id" INTEGER NOT NULL,
  "revisao" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "VotacaoDestaquePartida_pkey" PRIMARY KEY ("partida_id"),
  CONSTRAINT "VotacaoDestaquePartida_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "Partida"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE TABLE "VotoDestaquePartida" (
  "partida_id" INTEGER NOT NULL,
  "usuario_id" INTEGER NOT NULL,
  "jogador_id" INTEGER NOT NULL,
  "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VotoDestaquePartida_pkey" PRIMARY KEY ("partida_id", "usuario_id"),
  CONSTRAINT "VotoDestaquePartida_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "Partida"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VotoDestaquePartida_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VotoDestaquePartida_jogador_id_fkey" FOREIGN KEY ("jogador_id") REFERENCES "Jogador"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "VotoDestaquePartida_partida_id_jogador_id_idx" ON "VotoDestaquePartida"("partida_id", "jogador_id");
