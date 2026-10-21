import { Children, ReactNode, useEffect, useRef, useState } from 'react';
import './BlockColumns.css';

// Colunas independentes: abrir um cartão nunca reposiciona a coluna vizinha.
export function BlockColumns({ children, list = false, minWidth = 320, maxColumns = 3 }: {
  children: ReactNode; list?: boolean; minWidth?: number; maxColumns?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(1);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setCount(Math.max(1, Math.min(maxColumns, Math.floor((entry.contentRect.width + 16) / (minWidth + 16))))));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [minWidth, maxColumns]);
  const columns = Array.from({ length: list ? 1 : count }, () => [] as ReactNode[]);
  Children.toArray(children).forEach((child, index) => columns[index % columns.length].push(child));
  return <div ref={ref} className="block-columns" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
    {columns.map((items, index) => <div className="block-column" key={index}>{items}</div>)}
  </div>;
}
