-- CreateEnum
CREATE TYPE "StatusConvite" AS ENUM ('PENDENTE', 'ACEITO', 'REVOGADO');

-- CreateTable
CREATE TABLE "ConviteClube" (
    "id" TEXT NOT NULL,
    "clube_id" INTEGER NOT NULL,
    "criado_por_id" INTEGER,
    "aceito_por_id" INTEGER,
    "email" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL,
    "acesso_todas_categorias" BOOLEAN NOT NULL DEFAULT false,
    "token_hash" TEXT NOT NULL,
    "status" "StatusConvite" NOT NULL DEFAULT 'PENDENTE',
    "expira_em" TIMESTAMP(3) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aceito_em" TIMESTAMP(3),
    "revogado_em" TIMESTAMP(3),

    CONSTRAINT "ConviteClube_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConviteCategoria" (
    "convite_id" TEXT NOT NULL,
    "categoria_id" INTEGER NOT NULL,

    CONSTRAINT "ConviteCategoria_pkey" PRIMARY KEY ("convite_id","categoria_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConviteClube_token_hash_key" ON "ConviteClube"("token_hash");

-- CreateIndex
CREATE INDEX "ConviteClube_clube_id_status_idx" ON "ConviteClube"("clube_id", "status");

-- CreateIndex
CREATE INDEX "ConviteClube_email_idx" ON "ConviteClube"("email");

-- CreateIndex
CREATE INDEX "ConviteClube_expira_em_idx" ON "ConviteClube"("expira_em");

-- CreateIndex
CREATE INDEX "ConviteCategoria_categoria_id_idx" ON "ConviteCategoria"("categoria_id");

-- AddForeignKey
ALTER TABLE "ConviteClube" ADD CONSTRAINT "ConviteClube_clube_id_fkey" FOREIGN KEY ("clube_id") REFERENCES "Clube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConviteClube" ADD CONSTRAINT "ConviteClube_criado_por_id_fkey" FOREIGN KEY ("criado_por_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConviteClube" ADD CONSTRAINT "ConviteClube_aceito_por_id_fkey" FOREIGN KEY ("aceito_por_id") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConviteCategoria" ADD CONSTRAINT "ConviteCategoria_convite_id_fkey" FOREIGN KEY ("convite_id") REFERENCES "ConviteClube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConviteCategoria" ADD CONSTRAINT "ConviteCategoria_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;
