-- Compatível com convites existentes: códigos antigos não são reconstruídos.
ALTER TABLE "ConviteClube" ADD COLUMN "codigo_cifrado" TEXT;
