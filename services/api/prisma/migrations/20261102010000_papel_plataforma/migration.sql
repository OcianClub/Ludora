CREATE TYPE "PapelPlataforma" AS ENUM ('USUARIO', 'SUPERADMIN');

ALTER TABLE "Usuario"
ADD COLUMN "papel_plataforma" "PapelPlataforma" NOT NULL DEFAULT 'USUARIO';
