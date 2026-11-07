CREATE TABLE "FpfsCatalogo" (
  "id" INTEGER NOT NULL PRIMARY KEY,
  "ano" INTEGER NOT NULL,
  "divisao" TEXT NOT NULL,
  "categoria" TEXT NOT NULL,
  "equipes" JSONB NOT NULL,
  "descobertoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acompanhado" BOOLEAN NOT NULL DEFAULT false,
  "tentativaEm" TIMESTAMP(3),
  "sucessoEm" TIMESTAMP(3),
  "proximaEm" TIMESTAMP(3),
  "erro" TEXT
);
CREATE TABLE "FpfsRotina" (
  "id" INTEGER NOT NULL PRIMARY KEY,
  "descobertaEm" TIMESTAMP(3),
  "proximaEm" TIMESTAMP(3),
  "erro" TEXT,
  "leaseAte" TIMESTAMP(3)
);
