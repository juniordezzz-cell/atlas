/* ============================================================
   ATLAS · core/atlas-export.js
   Levar o dado para fora: planilha e papel.

   POR QUE ISTO EXISTE
   -------------------
   O ATLAS exportava um `.json` de backup e nada mais. Backup serve para
   restaurar o sistema, não para trabalhar: ninguém abre um `.json` no
   Excel para conferir o fluxo do trimestre, nem manda um `.json` para o
   contador. Relatório que só existe dentro do produto é relatório que
   não sai da mesa.

   São dois destinos, e eles pedem coisas diferentes:

     PLANILHA → CSV. Sem biblioteca, sem build, sem dependência.
     PAPEL/PDF → a própria página, via themes/atlas-print.css.

   POR QUE NÃO UMA BIBLIOTECA DE PDF
   ---------------------------------
   Gerar PDF em JavaScript (jsPDF e afins) significaria uma dependência
   de CDN de centenas de KB, quebrando a promessa de "sem build, sem
   dependências" — e entregando tipografia PIOR do que a que o navegador
   já produz. Todo navegador moderno imprime em PDF nativamente, com as
   fontes certas, hifenização e seleção de texto. O trabalho real não é
   desenhar o PDF: é preparar a página para virar folha. Isso já está
   feito em themes/atlas-print.css, e o que faltava era o CABEÇALHO —
   um relatório sem carteira, período e data é uma folha anônima.

   POR QUE PONTO E VÍRGULA NO CSV
   ------------------------------
   O ATLAS é pt-BR e o número decimal usa vírgula. Num Excel configurado
   em português, um CSV separado por vírgula joga tudo numa coluna só —
   o formato "correto" produz o resultado errado na máquina do usuário.
   Ponto e vírgula é o que o Excel pt-BR espera, e o BOM no início é o
   que faz "Ações" aparecer como "Ações" e não como "AÃ§Ãµes".

   COMO USAR
   ---------
     AtlasExport.csv("fluxo-2026-08", ["Data","Tipo"], [["01/08","Entrada"]]);
     AtlasExport.imprimir({ titulo: "Relatórios", subtitulo: "Carteira Principal" });
   ============================================================ */
(function () {
  "use strict";
  if (window.AtlasExport) return;

  var SEP = ";";
  var BOM = "﻿";

  /* ---------- CSV ---------- */

  /* Uma célula precisa de aspas se contém o separador, aspas, quebra de
     linha — ou se começa com =, +, - ou @. Esses quatro fazem o Excel
     interpretar o conteúdo como FÓRMULA: uma célula de texto começando
     com "=" vira execução. É a injeção de fórmula em CSV, e a defesa é
     prefixar com apóstrofo, que o Excel entende como "isto é texto". */
  function celula(v) {
    if (v == null) return "";
    var s = String(v);
    /* ...mas um número negativo é só um número. Prefixar "-90" faria a
       planilha inteira virar texto e nenhuma soma funcionaria — o
       remédio seria pior. Só escapa o que NÃO é número. */
    if (/^[=+\-@]/.test(s) && !/^[+\-]?\d+([.,]\d+)?$/.test(s)) s = "'" + s;
    if (s.indexOf(SEP) >= 0 || s.indexOf('"') >= 0 || /[\r\n]/.test(s)) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function montarCsv(colunas, linhas) {
    var out = [];
    if (colunas && colunas.length) out.push(colunas.map(celula).join(SEP));
    (linhas || []).forEach(function (l) { out.push((l || []).map(celula).join(SEP)); });
    /* CRLF porque é o que o Excel espera; \n sozinho funciona no Excel
       moderno mas não em todo importador antigo. */
    return BOM + out.join("\r\n") + "\r\n";
  }

  /* Número para planilha: vírgula decimal e SEM separador de milhar. O
     separador de milhar é o que mais estraga importação — o Excel lê
     "1.234,50" como texto em metade das configurações. Duas casas fixas
     porque é dinheiro. */
  function numero(v) {
    var n = Number(v);
    if (!isFinite(n)) return "";
    return n.toFixed(2).replace(".", ",");
  }

  function baixar(nomeArquivo, conteudo, mime) {
    var blob = new Blob([conteudo], { type: (mime || "text/plain") + ";charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    /* Revogar na hora corta o download no Safari. Um tique de atraso
       resolve e não custa nada. */
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 800);
  }

  function carimbo() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : String(n); }
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }

  /* Nome de arquivo tem de sobreviver ao Windows: nada de \ / : * ? " < > |
     e nada de acento, que vira lixo em alguns clientes de e-mail. */
  function nomeSeguro(s) {
    var t = String(s || "atlas");
    /* A classe dos combinantes (U+0300–U+036F) é montada por string e
       não escrita como literal: combinante solto no meio do arquivo é
       invisível no editor e some em qualquer ferramenta que reencode o
       código. Em string, o escape sobrevive a qualquer codificação. */
    var COMBINANTES = new RegExp("[\\u0300-\\u036f]", "g");
    if (t.normalize) t = t.normalize("NFD").replace(COMBINANTES, "");
    return t.replace(/[\\/:*?"<>|]+/g, "-")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase() || "atlas";
  }

  /* ---------- IMPRESSÃO / PDF ---------- */

  /* O cabeçalho só existe no papel. Fica escondido em tela por CSS
     (themes/atlas-print.css) em vez de ser inserido e removido a cada
     impressão: assim ele aparece também quando o usuário imprime pelo
     Ctrl+P do navegador, sem passar pelo nosso botão. */
  function montarCabecalho(cfg) {
    cfg = cfg || {};
    var host = document.querySelector('[data-atlas-ui="printhead"]');
    if (!host) {
      host = document.createElement("div");
      host.className = "atlas-printhead";
      host.setAttribute("data-atlas-ui", "printhead");
      document.body.insertBefore(host, document.body.firstChild);
    }
    var perfil = (window.AtlasSettings && AtlasSettings.profile) ? AtlasSettings.profile() : { name: "" };
    var agora = new Date();
    var quando = (window.AtlasSettings && AtlasSettings.formatDate)
      ? AtlasSettings.formatDate(agora)
      : agora.toLocaleDateString("pt-BR");

    function esc(s) {
      return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
      });
    }

    host.innerHTML =
      '<div class="atlas-printhead__marca">ATLAS</div>' +
      '<div class="atlas-printhead__t">' +
        '<strong>' + esc(cfg.titulo || document.title || "Relatório") + '</strong>' +
        (cfg.subtitulo ? '<span>' + esc(cfg.subtitulo) + '</span>' : "") +
      '</div>' +
      '<div class="atlas-printhead__meta">' +
        (perfil.name ? '<span>' + esc(perfil.name) + '</span>' : "") +
        '<span>' + esc(quando) + '</span>' +
      '</div>';
    return host;
  }

  function imprimir(cfg) {
    montarCabecalho(cfg);
    /* Um tique de espera: o cabeçalho acabou de entrar no DOM e o
       print() do navegador é síncrono — sem isso, a primeira impressão
       pode sair sem ele.

       setTimeout e não requestAnimationFrame: rAF só dispara quando a
       página está COMPONDO QUADROS. Numa aba em segundo plano, numa
       janela minimizada ou num painel que não pinta, o rAF simplesmente
       não roda e a impressão nunca acontece. O relógio sempre anda. */
    setTimeout(function () { window.print(); }, 30);
  }

  window.AtlasExport = {
    csv: function (nome, colunas, linhas) {
      baixar(nomeSeguro(nome) + "-" + carimbo() + ".csv", montarCsv(colunas, linhas), "text/csv");
    },
    montarCsv: montarCsv,
    numero: numero,
    baixar: baixar,
    carimbo: carimbo,
    imprimir: imprimir,
    cabecalhoImpressao: montarCabecalho
  };
})();
