"""
ATLAS - servidor local para abrir o app por http (usado pelo "Abrir ATLAS.bat").

E o mesmo `python -m http.server`, com UMA diferenca: manda o navegador
nunca guardar copia (Cache-Control: no-store). O servidor puro do Python
nao manda cabecalho de cache, entao o Chrome guardava HTML/JS por conta
propria e, depois de uma correcao, continuava rodando a versao velha
("corrigi e nao pegou"). Ver docs/visual-ferramentas-2026-10-15.md.

Uso:  py -3 servidor-local.py [porta]     (padrao: 8777)
"""
import functools
import http.server
import os
import sys


class SemCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()

    # sem o 304: com no-store o navegador nem deveria perguntar, mas se
    # perguntar (If-Modified-Since), responde sempre o arquivo inteiro
    def send_head(self):
        for nome in ("If-Modified-Since", "If-None-Match"):
            if nome in self.headers:
                del self.headers[nome]
        return super().send_head()


def main():
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    raiz = os.path.dirname(os.path.abspath(__file__))
    handler = functools.partial(SemCache, directory=raiz)
    with http.server.ThreadingHTTPServer(("", porta), handler) as srv:
        print(f"ATLAS em http://localhost:{porta}/  (sem cache; feche esta janela para desligar)")
        srv.serve_forever()


if __name__ == "__main__":
    main()
