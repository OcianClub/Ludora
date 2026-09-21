-- AlterTable
ALTER TABLE "UsuarioClube" ADD COLUMN     "acesso_todas_categorias" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "UsuarioClubeCategoria" (
    "usuario_clube_id" INTEGER NOT NULL,
    "categoria_id" INTEGER NOT NULL,

    CONSTRAINT "UsuarioClubeCategoria_pkey" PRIMARY KEY ("usuario_clube_id","categoria_id")
);

-- CreateIndex
CREATE INDEX "UsuarioClubeCategoria_categoria_id_idx" ON "UsuarioClubeCategoria"("categoria_id");

-- AddForeignKey
ALTER TABLE "UsuarioClubeCategoria" ADD CONSTRAINT "UsuarioClubeCategoria_usuario_clube_id_fkey" FOREIGN KEY ("usuario_clube_id") REFERENCES "UsuarioClube"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsuarioClubeCategoria" ADD CONSTRAINT "UsuarioClubeCategoria_categoria_id_fkey" FOREIGN KEY ("categoria_id") REFERENCES "Categoria"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "UsuarioClube" SET "acesso_todas_categorias" = true WHERE "papel" IN ('ADMIN', 'TECNICO', 'MESARIO');