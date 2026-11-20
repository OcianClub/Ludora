CREATE TABLE "AvisoPartidaPendente" (
    "chave" TEXT NOT NULL,
    "partida_id" INTEGER NOT NULL,
    "clube_id" INTEGER NOT NULL,
    "tipo" "TipoNotificacao" NOT NULL,
    "titulo" TEXT NOT NULL,
    "corpo" TEXT NOT NULL,
    "criada_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AvisoPartidaPendente_pkey" PRIMARY KEY ("chave"),
    CONSTRAINT "AvisoPartidaPendente_partida_id_fkey" FOREIGN KEY ("partida_id") REFERENCES "Partida"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AvisoPartidaPendente_criada_em_chave_idx" ON "AvisoPartidaPendente"("criada_em", "chave");
CREATE INDEX "AvisoPartidaPendente_partida_id_idx" ON "AvisoPartidaPendente"("partida_id");
