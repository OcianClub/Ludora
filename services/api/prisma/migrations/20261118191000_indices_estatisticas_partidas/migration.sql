CREATE INDEX "Evento_jogador_id_partida_id_idx" ON "Evento"("jogador_id", "partida_id");
CREATE INDEX "EscalacaoPartida_jogador_id_partida_id_idx" ON "EscalacaoPartida"("jogador_id", "partida_id");
CREATE INDEX "ParticipantePartida_clube_id_partida_id_idx" ON "ParticipantePartida"("clube_id", "partida_id");
