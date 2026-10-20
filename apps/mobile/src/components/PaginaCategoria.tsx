import { useEffect, useState, type ReactNode } from 'react';

/** Prepara páginas vizinhas e mantém as já visitadas na fase atual. */
export function PaginaCategoria({ grupo, preparar, children }: {
  grupo: string;
  preparar: boolean;
  children: ReactNode;
}) {
  const [grupoPreparado, setGrupoPreparado] = useState(preparar ? grupo : null);
  useEffect(() => {
    if (preparar) setGrupoPreparado(grupo);
  }, [grupo, preparar]);
  return preparar || grupoPreparado === grupo ? children : null;
}
