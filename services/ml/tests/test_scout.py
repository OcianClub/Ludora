import asyncio
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi import HTTPException, Request
from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import JogadorStats, autenticar_servico, treinar_perfis, validar_configuracao, app


def request(host="127.0.0.1", key=""):
    return Request({
        "type": "http", "headers": [(b"x-ml-api-key", key.encode())],
        "client": (host, 12345),
    })


class ScoutTests(unittest.TestCase):
    def test_chave_obrigatoria_producao(self):
        with patch.dict("os.environ", {"NODE_ENV": "production", "ML_API_KEY": ""}):
            with self.assertRaises(RuntimeError):
                validar_configuracao()
            with self.assertRaises(HTTPException) as erro:
                autenticar_servico(request())
            self.assertEqual(erro.exception.status_code, 503)

    def test_chave_confere_e_nao_vaza_no_erro(self):
        with patch.dict("os.environ", {"ML_API_KEY": "chave-de-teste"}):
            autenticar_servico(request("10.0.0.1", "chave-de-teste"))
            for chave in ["", "errada", "chave-de-teste-extra"]:
                with self.assertRaises(HTTPException) as erro:
                    autenticar_servico(request(key=chave))
                self.assertEqual(erro.exception.status_code, 401)
                self.assertNotIn("chave-de-teste", erro.exception.detail)

    def test_sem_chave_apenas_loopback_em_desenvolvimento(self):
        with patch.dict("os.environ", {"NODE_ENV": "development", "ML_API_KEY": ""}):
            for host in ["127.0.0.1", "::1"]:
                autenticar_servico(request(host))
            for host in ["192.168.1.5", "127.0.0.1.evil.test", "10.0.0.2"]:
                with self.assertRaises(HTTPException):
                    autenticar_servico(request(host))

    def test_validacao_limita_dados(self):
        for dados in [{"jogador_id": 0}, {"jogador_id": 1, "GOL": -1},
                      {"jogador_id": 1, "jogos_disputados": -1},
                      {"jogador_id": 1, "DEFESA": 1_000_001}]:
            with self.assertRaises(ValidationError):
                JogadorStats(**dados)

    def test_pouca_diversidade_retorna_validacao_em_vez_de_crash(self):
        for quantidade in [3, 10]:
            with self.assertRaises(HTTPException) as erro:
                treinar_perfis([JogadorStats(jogador_id=id + 1) for id in range(quantidade)])
            self.assertEqual(erro.exception.status_code, 400)

    def test_duplicados_e_lote_excessivo(self):
        for dados in [
            [JogadorStats(jogador_id=1)] * 3,
            [JogadorStats(jogador_id=id + 1) for id in range(5001)],
        ]:
            with self.assertRaises(HTTPException) as erro:
                treinar_perfis(dados)
            self.assertEqual(erro.exception.status_code, 400)

    def test_perfis_variados_preservam_resultados_finitos(self):
        resultados = treinar_perfis([
            JogadorStats(jogador_id=1, GOL=10, jogos_disputados=2),
            JogadorStats(jogador_id=2, ASSISTENCIA=10, jogos_disputados=2),
            JogadorStats(jogador_id=3, DEFESA=10, jogos_disputados=2),
        ])
        self.assertEqual({r.perfil_ml for r in resultados}, {"Artilheiro", "Armador", "Paredão"})
        self.assertTrue(all(0 <= r.nota_geral <= 100 for r in resultados))
        self.assertTrue(all(0 <= s <= 100 for r in resultados for s in r.scores.values()))

    def test_http_rejeita_chave_antes_do_processamento(self):
        async def executar():
            mensagens = []
            async def receber():
                return {"type": "http.request", "body": b"[]"}
            async def enviar(mensagem):
                mensagens.append(mensagem)
            await app({
                "type": "http", "http_version": "1.1", "method": "POST",
                "scheme": "http", "path": "/internal/ml/treinar-perfis",
                "raw_path": b"/internal/ml/treinar-perfis", "query_string": b"",
                "root_path": "", "headers": [(b"content-type", b"application/json")],
                "client": ("10.0.0.2", 12345), "server": ("127.0.0.1", 8000),
            }, receber, enviar)
            self.assertEqual(mensagens[0]["status"], 401)
        with patch.dict("os.environ", {"ML_API_KEY": "chave-teste"}):
            asyncio.run(executar())


if __name__ == "__main__":
    unittest.main()
