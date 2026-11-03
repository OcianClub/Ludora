from contextlib import asynccontextmanager
from hmac import compare_digest
import os
from typing import List, Dict

import numpy as np
from fastapi import Depends, FastAPI, HTTPException, Request
from pydantic import BaseModel, Field
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import RobustScaler


def validar_configuracao():
    if os.getenv("NODE_ENV") == "production" and not os.getenv("ML_API_KEY"):
        raise RuntimeError("Configure ML_API_KEY para executar o Scout IA em produção.")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    validar_configuracao()
    yield


app = FastAPI(title="Ludora Scout IA", lifespan=lifespan)


@app.get("/health")
def health():
    return {"status": "ok", "versao": 2}


def autenticar_servico(request: Request):
    chave = os.getenv("ML_API_KEY", "")
    if chave:
        recebida = request.headers.get("X-ML-API-Key", "")
        if not compare_digest(recebida.encode(), chave.encode()):
            raise HTTPException(status_code=401, detail="Serviço não autorizado.")
        return
    if os.getenv("NODE_ENV") == "production":
        raise HTTPException(status_code=503, detail="Serviço indisponível.")
    if not request.client or request.client.host not in {"127.0.0.1", "::1"}:
        raise HTTPException(status_code=401, detail="Serviço não autorizado.")


class JogadorStats(BaseModel):
    jogador_id: int = Field(gt=0, le=2_147_483_647)
    categoria_id: int = Field(default=0, ge=0)
    posicao: str = Field(default="", max_length=60)
    GOL: int = Field(default=0, ge=0, le=1_000_000)
    ASSISTENCIA: int = Field(default=0, ge=0, le=1_000_000)
    DEFESA: int = Field(default=0, ge=0, le=1_000_000)
    CARTAO_AMARELO: int = Field(default=0, ge=0, le=1_000_000)
    CARTAO_VERMELHO: int = Field(default=0, ge=0, le=1_000_000)
    FALTA: int = Field(default=0, ge=0, le=1_000_000)
    jogos_disputados: int = Field(default=0, ge=0, le=1_000_000)


class Semelhante(BaseModel):
    jogador_id: int
    distancia: float


class ScoutResultado(BaseModel):
    jogador_id: int
    versao: int = 2
    perfil_ml: str
    nota_geral: None = None
    scores: Dict[str, float]
    convocacoes: int
    grupo_tamanho: int = 0
    semelhantes: List[Semelhante] = Field(default_factory=list)
    metodo: str = "v2-registros-por-convocacao"


def normalizar_posicao(posicao: str):
    value = posicao.strip().lower()
    return "ala" if value in {"ala", "alas"} else value


@app.post("/internal/ml/treinar-perfis", response_model=List[ScoutResultado],
          dependencies=[Depends(autenticar_servico)])
def treinar_perfis(stats: List[JogadorStats]):
    if not stats or len(stats) > 5000:
        raise HTTPException(status_code=400, detail="Envie entre 1 e 5000 atletas por análise.")
    if len({s.jogador_id for s in stats}) != len(stats):
        raise HTTPException(status_code=400, detail="A análise contém jogadores duplicados.")

    resultados = []
    grupos = {}
    for jogador in stats:
        eventos = [jogador.GOL, jogador.ASSISTENCIA, jogador.DEFESA]
        perfil = "Sem dados"
        if jogador.jogos_disputados >= 5 and sum(eventos) >= 3:
            maiores = [i for i, count in enumerate(eventos) if count == max(eventos)]
            perfil = ["Artilheiro", "Armador", "Paredão"][maiores[0]] if len(maiores) == 1 else "Misto"
        resultados.append(ScoutResultado(
            jogador_id=jogador.jogador_id, perfil_ml=perfil,
            convocacoes=jogador.jogos_disputados,
            scores={key: round(value / jogador.jogos_disputados, 4) if jogador.jogos_disputados else 0
                    for key, value in zip(["gols_por_convocacao", "assistencias_por_convocacao", "defesas_por_convocacao"], eventos)},
        ))
        posicao = normalizar_posicao(jogador.posicao)
        if jogador.categoria_id and posicao and jogador.jogos_disputados >= 5 and sum(eventos):
            grupos.setdefault((jogador.categoria_id, posicao), []).append(len(resultados) - 1)

    for indices in grupos.values():
        indices.sort(key=lambda i: resultados[i].jogador_id)
        for index in indices:
            resultados[index].grupo_tamanho = len(indices)
        if len(indices) < 5:
            continue
        matriz = np.array([list(resultados[i].scores.values()) for i in indices])
        # Similaridade de registros, sem atribuir habilidade ou prever desempenho.
        scaled = RobustScaler().fit_transform(matriz)
        modelo = NearestNeighbors(n_neighbors=4, metric="euclidean", algorithm="kd_tree").fit(scaled)
        distancias, vizinhos = modelo.kneighbors(scaled)
        for linha, index in enumerate(indices):
            candidatos = [(float(d), resultados[indices[v]].jogador_id)
                          for d, v in zip(distancias[linha], vizinhos[linha]) if indices[v] != index]
            candidatos.sort(key=lambda pair: (pair[0], pair[1]))
            resultados[index].semelhantes = [Semelhante(jogador_id=id, distancia=round(d, 4))
                                               for d, id in candidatos[:3]]
    return resultados


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=os.getenv("ML_HOST", "127.0.0.1"), port=8000)
