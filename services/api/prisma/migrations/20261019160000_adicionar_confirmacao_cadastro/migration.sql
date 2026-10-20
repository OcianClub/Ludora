CREATE TABLE "ConfirmacaoCadastro" (
    "email" TEXT NOT NULL,
    "desafio" TEXT NOT NULL,
    "codigo_hash" TEXT NOT NULL,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ConfirmacaoCadastro_pkey" PRIMARY KEY ("email")
);

CREATE UNIQUE INDEX "ConfirmacaoCadastro_desafio_key" ON "ConfirmacaoCadastro"("desafio");
CREATE INDEX "ConfirmacaoCadastro_expira_em_idx" ON "ConfirmacaoCadastro"("expira_em");
