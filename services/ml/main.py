from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict
import pandas as pd
import numpy as np
from sklearn.preprocessing import MinMaxScaler
from sklearn.cluster import KMeans

app = FastAPI(title="OcianClub Scout AI")

class JogadorStats(BaseModel):
    jogador_id: int
    GOL: int = 0
    ASSISTENCIA: int = 0
    DEFESA: int = 0
    CARTAO_AMARELO: int = 0
    CARTAO_VERMELHO: int = 0
    FALTA: int = 0
    jogos_disputados: int = 1

class ScoutResultado(BaseModel):
    jogador_id: int
    perfil_ml: str
    scores: Dict[str, float]
    nota_geral: float

@app.post("/internal/ml/treinar-perfis", response_model=List[ScoutResultado])
def treinar_perfis(stats: List[JogadorStats]):
    if len(stats) < 3:
        raise HTTPException(
            status_code=400,
            detail="Mínimo de 3 jogadores com partidas para análise de IA."
        )

    df = pd.DataFrame([s.dict() for s in stats])
    ids = df['jogador_id'].values
    
    jogos = df['jogos_disputados'].replace(0, 1)

    df['gols_pj'] = df['GOL'] / jogos
    df['assis_pj'] = df['ASSISTENCIA'] / jogos
    df['defesa_pj'] = df['DEFESA'] / jogos
    df['falta_pj'] = df['FALTA'] / jogos
    df['cartao_pj'] = (df['CARTAO_AMARELO'] + 2 * df['CARTAO_VERMELHO']) / jogos

    scaler = MinMaxScaler(feature_range=(0, 100))

    def safe_scale(col):
        if df[col].max() == 0:
            return np.zeros(len(df))
        return scaler.fit_transform(df[[col]]).flatten()

    finalizacao = safe_scale('gols_pj')
    visao_de_jogo = safe_scale('assis_pj')
    defesa = safe_scale('defesa_pj')

    indisciplina = df['falta_pj'] + df['cartao_pj']
    if indisciplina.max() == 0:
        disciplina = np.full(len(df), 100.0)
    else:
        ind_scaled = scaler.fit_transform(indisciplina.values.reshape(-1, 1)).flatten()
        disciplina = 100 - ind_scaled

    intensidade = safe_scale('falta_pj') * 0.5 + safe_scale('defesa_pj') * 0.5
    tecnica = safe_scale('assis_pj') * 0.5 + safe_scale('gols_pj') * 0.5

    features_km = np.column_stack((finalizacao, visao_de_jogo, defesa, disciplina, intensidade))
    
    kmeans = KMeans(n_clusters=3, random_state=42, n_init=10)
    clusters = kmeans.fit_predict(features_km)

    centroids = pd.DataFrame(features_km, columns=['fin', 'vis', 'def', 'dis', 'int'])
    centroids['cluster'] = clusters
    medias = centroids.groupby('cluster').mean()

    # O cluster com mais defesas é inevitavelmente o dos Goleiros
    idx_paredao = medias['def'].idxmax()
    
    # Removemos o goleiro para achar os Alas
    restantes = medias.drop(idx_paredao) 
    
    # Entre os Alas, quem finaliza mais é o Artilheiro
    idx_artilheiro = restantes['fin'].idxmax()
    
    # O cluster que sobrou é o Armador (Geralmente alas mais passadores/fixos)
    idx_armador = [i for i in range(3) if i not in (idx_paredao, idx_artilheiro)][0]

    nomes_perfis = {}
    for i in range(3):
        if i == idx_artilheiro:
            nomes_perfis[i] = "Artilheiro"
        elif i == idx_paredao:
            nomes_perfis[i] = "Paredão"
        else:
            nomes_perfis[i] = "Armador"

    resultados = []
    for idx, jogador_id in enumerate(ids):
        nota_geral = (finalizacao[idx] + visao_de_jogo[idx] + defesa[idx] + disciplina[idx] + tecnica[idx]) / 5

        resultados.append(ScoutResultado(
            jogador_id=int(jogador_id),
            perfil_ml=nomes_perfis[clusters[idx]],
            scores={
                "finalizacao":   round(float(finalizacao[idx]), 1),
                "visao_de_jogo": round(float(visao_de_jogo[idx]), 1),
                "defesa":        round(float(defesa[idx]), 1),
                "disciplina":    round(float(disciplina[idx]), 1),
                "intensidade":   round(float(intensidade[idx]), 1),
                "tecnica":       round(float(tecnica[idx]), 1)
            },
            nota_geral=round(float(nota_geral), 1)
        ))

    return resultados

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)