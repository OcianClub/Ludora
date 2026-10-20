ALTER TABLE "Usuario" ADD COLUMN "versao_sessao" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "RecuperacaoSenha" (
    "id" TEXT NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    CONSTRAINT "RecuperacaoSenha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecuperacaoSenha_usuario_id_key" ON "RecuperacaoSenha"("usuario_id");
CREATE INDEX "RecuperacaoSenha_expira_em_idx" ON "RecuperacaoSenha"("expira_em");
ALTER TABLE "RecuperacaoSenha" ADD CONSTRAINT "RecuperacaoSenha_usuario_id_fkey"
    FOREIGN KEY ("usuario_id") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
