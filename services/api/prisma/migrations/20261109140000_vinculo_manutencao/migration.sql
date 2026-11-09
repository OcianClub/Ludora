BEGIN;

ALTER TABLE "Manutencao" ADD COLUMN "chamadoId" TEXT;
ALTER TABLE "Manutencao" ADD CONSTRAINT "Manutencao_chamadoId_fkey"
  FOREIGN KEY ("chamadoId") REFERENCES "SuporteChamado"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Manutencao_chamadoId_idx" ON "Manutencao"("chamadoId");

-- Estas tabelas são de uso da API Express. Não têm acesso pela Data API.
DO $$
DECLARE
  tabela text;
  papel text;
BEGIN
  FOREACH tabela IN ARRAY ARRAY['SuporteChamado', 'SuporteHistorico', 'SuporteAcao',
    'RecuperacaoExcepcional', 'Manutencao', 'ManutencaoHistorico', 'TarefaCadastroClube', 'AuditoriaContaInterna'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tabela);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', tabela);
    FOREACH papel IN ARRAY ARRAY['anon', 'authenticated'] LOOP
      IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = papel) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', tabela, papel);
      END IF;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
