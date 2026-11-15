#!/usr/bin/env node
/* ============================================================
   Laboratório de Agentes (no PC) · servidor.mjs

   Liga o Laboratório: abre o arquivo de dados, roda o ciclo (rodada.mjs) a
   cada minuto e serve a tela em http://localhost:4321 (só neste PC).

   A tela recebe os avisos por /api/eventos (atualiza sozinha) e os dados
   por /api/painel.

   Uso:  node laboratorio/servidor.mjs [--sem-navegador] [--porta 4321]
   Se o Laboratório já estiver aberto, só abre o navegador nele.
   ============================================================ */

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { Banco } from "./banco.mjs";
import { passo, INTERVALOS } from "./rodada.mjs";
import { AGENTES } from "../estudio/agentes/regras.mjs";

const args = process.argv.slice(2);
const PORTA = Number(args[args.indexOf("--porta") + 1]) || 4321;
const ABRIR = !args.includes("--sem-navegador");
const URL_LOCAL = `http://localhost:${PORTA}`;
const DADOS = fileURLToPath(new URL("./dados/laboratorio.db", import.meta.url));
const PAGINA = fileURLToPath(new URL("./pagina/index.html", import.meta.url));
const NOME = Object.fromEntries(AGENTES.map((a) => [a.id, a.nome]));

const agora = () => Math.floor(Date.now() / 1000);
const hora = () => new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
const log = (...x) => console.log(`[${hora()}]`, ...x);

function abrirNavegador() {
  if (!ABRIR) return;
  const [cmd, a] = process.platform === "win32" ? ["cmd", ["/c", "start", "", URL_LOCAL]]
    : process.platform === "darwin" ? ["open", [URL_LOCAL]] : ["xdg-open", [URL_LOCAL]];
  spawn(cmd, a, { stdio: "ignore", detached: true }).unref();
}

/** Tudo o que a tela mostra, num JSON só. */
export function painel(banco, t, ciclo) {
  const ultima = banco.ultimaRodada();
  const rod = ultima ? banco.db.prepare("select * from rodadas where rodada = ?").get(ultima) : null;
  const resumo = rod ? JSON.parse(rod.resumo) : null;
  const boletim = banco.ler("boletim", {});
  const achados = ultima ? banco.db.prepare("select dados from achados where rodada = ? order by media_usd desc").all(ultima)
    .map((r) => {
      const a = JSON.parse(r.dados);
      return {
        agente: a.agente, nome: NOME[a.agente] ?? a.agente, pool_id: a.pool_id, rede: a.rede, dex: a.dex, par: a.par,
        modelo: a.modelo, faixas: a.faixas, preco: a.preco, faixa_min: a.faixa_min, faixa_max: a.faixa_max,
        posicoes: a.posicoes, capital_usd: a.capital_usd, dias: a.dias, media_usd: a.media_usd, p10_usd: a.p10_usd,
        p90_usd: a.p90_usd, custo_usd: a.custo_usd, taxas_usd: a.taxas_usd, em_faixa_pct: a.em_faixa_pct,
        prob_perda_pct: a.prob_perda_pct, ganho_vs_ref_usd: a.ganho_vs_ref_usd, tokens: a.metricas?.tokens ?? null,
        motivo: a.metricas?.regra ?? null, ativo: a.ativo_simbolo, cotacao: a.cotacao,
      };
    }) : [];
  const analises = banco.db.prepare("select pool_id, agente, dados from analises").all()
    .map((r) => ({ pool_id: r.pool_id, agente: r.agente, ...JSON.parse(r.dados) }));
  const pools = banco.poolsAtivas().map((p) => ({ pool_id: p.pool_id, rede: p.rede, dex: p.dex, par: p.par, tvl: p.tvl_snap ?? p.tvl,
    vol_24h: p.vol_snap ?? p.vol_24h, pronta: p.primeira_vela != null && p.primeira_vela <= t - 7 * 86400, fonte: p.fonte }));
  const precosEm = banco.ler("precos_em");
  return {
    agora: t,
    ciclo: {
      etapa: ciclo.etapa, desde: ciclo.desde, ultimo_erro: banco.ler("ultimo_erro"), ultimo_passo: banco.ler("ultimo_passo"),
      scanner_em: banco.ler("scanner_em"), precos_em: precosEm,
      proxima: precosEm ? precosEm + INTERVALOS.precos : null,
    },
    rodada: rod ? { em: rod.rodada, pools: rod.pools, achados: rod.achados, disputas: rod.disputas, conflitos: rod.conflitos,
      duracao_s: rod.duracao_s } : null,
    agentes: AGENTES.map((a) => {
      const s = resumo?.status?.find((x) => x.agente === a.id);
      return { id: a.id, nome: a.nome, modelo: a.modelo, achados: s?.achados ?? 0, trabalhadas: s?.pools_trabalhadas ?? 0,
        mensagem: s?.mensagem ?? null, boletim: boletim[a.id] ?? null };
    }),
    achados,
    disputas: resumo?.relatorio?.disputas?.slice(0, 30) ?? [],
    pools,
    analises,
    registro: banco.db.prepare("select rodada, pools, achados, disputas, conflitos, duracao_s from rodadas order by rodada desc limit 24").all(),
  };
}

async function iniciar() {
  const banco = new Banco(DADOS);
  const ciclo = { etapa: "ligando", desde: agora(), rodando: false };
  const ouvintes = new Set();
  const avisar = (etapa, dados = {}) => {
    ciclo.etapa = etapa;
    ciclo.desde = agora();
    const msg = `data: ${JSON.stringify({ etapa, ...dados })}\n\n`;
    for (const r of ouvintes) r.write(msg);
    const texto = { scanner: "lendo o Scanner Pulse", precos: "buscando preços", agentes: "agentes trabalhando",
      boletim: "conferindo o boletim", pronto: "pronto", erro: `erro: ${dados.mensagem}` }[etapa] ?? etapa;
    log(texto, etapa === "pronto" ? JSON.stringify(dados) : "");
  };

  const servidor = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, URL_LOCAL);
      if (url.pathname === "/" || url.pathname === "/index.html") {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(await readFile(PAGINA));
      }
      if (url.pathname === "/api/painel") {
        res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
        return res.end(JSON.stringify(painel(banco, agora(), ciclo)));
      }
      if (url.pathname === "/api/eventos") {
        res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-store", Connection: "keep-alive" });
        res.write(`data: ${JSON.stringify({ etapa: ciclo.etapa })}\n\n`);
        ouvintes.add(res);
        req.on("close", () => ouvintes.delete(res));
        return;
      }
      res.writeHead(404).end("não encontrado");
    } catch (e) {
      res.writeHead(500).end(String(e.message));
    }
  });

  servidor.on("error", (e) => {
    if (e.code === "EADDRINUSE") {
      log(`O Laboratório já está aberto em ${URL_LOCAL}. Abrindo o navegador nele.`);
      abrirNavegador();
      setTimeout(() => process.exit(0), 500);
    } else throw e;
  });
  // Só este PC: escuta em 127.0.0.1, não na rede.
  servidor.listen(PORTA, "127.0.0.1", () => {
    log(`Laboratório de Agentes aberto em ${URL_LOCAL}  (feche esta janela para desligar)`);
    abrirNavegador();
    const girar = async () => {
      if (ciclo.rodando) return;
      ciclo.rodando = true;
      try { await passo(banco, agora(), { aviso: avisar }); } catch { /* já avisado */ }
      finally { ciclo.rodando = false; if (ciclo.etapa !== "erro") ciclo.etapa = "esperando"; }
    };
    girar();
    setInterval(girar, 60_000);
    setInterval(() => { for (const r of ouvintes) r.write(": ping\n\n"); }, 25_000);
  });
}

const mesmo = (a, b) => resolve(a).toLowerCase() === resolve(b).toLowerCase();
if (process.argv[1] && mesmo(fileURLToPath(import.meta.url), process.argv[1])) iniciar();
