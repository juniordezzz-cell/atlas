
    /* ---------- Utilitários ---------- */
    function atlasHash(str, seed) {
        seed = seed || 0;
        let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
        for (let i = 0; i < str.length; i++) {
            const ch = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ ch, 2654435761);
            h2 = Math.imul(h2 ^ ch, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
    }
    function blockHash(input) {
        let out = '';
        for (let s = 0; s < 4; s++) out += atlasHash(input + '::' + s, s * 7919 + 13);
        return out;
    }
    function mineSync(strBase, prefix) {
        let nonce = 0;
        while (nonce < 1000000) {
            const h = blockHash(strBase + nonce);
            if (h.startsWith(prefix)) return { nonce, hash: h };
            nonce++;
        }
        throw new Error("Limite didático de mineração alcançado. Reduza a dificuldade.");
    }
    function fmtUSD(n) {
        if (!isFinite(n) || isNaN(n)) return '—';
        const abs = Math.abs(n);
        if (abs >= 1e12) return 'US$ ' + (n / 1e12).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' tri';
        if (abs >= 1e9) return 'US$ ' + (n / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' bi';
        if (abs >= 1e6) return 'US$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
        if (abs >= 1e3) return 'US$ ' + (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
        return 'US$ ' + n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
    }
    function fmtNum(n) { return (!isFinite(n) || isNaN(n)) ? '—' : Math.round(n).toLocaleString('pt-BR'); }
    function fmtBRL(n) { return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    function fmtBRLc(n) {
        const abs = Math.abs(n);
        if (abs >= 1e9) return 'R$ ' + (n / 1e9).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' bi';
        if (abs >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
        if (abs >= 1e3) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
        return 'R$ ' + n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    }
    function fmtUS(n, d) { return 'US$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: d === undefined ? 2 : d, maximumFractionDigits: d === undefined ? 2 : d }); }

    /* ---------- App ---------- */
    const app = {
        currentView: 'dashboard', chartsInit: false, rafId: null,
        switchTab(tabId, trigger) {
            document.querySelectorAll('.tab-pane').forEach(p=>{p.classList.add('hidden');p.classList.remove('block');});
            const selected=document.getElementById('tab-'+tabId);
            if(selected){selected.classList.remove('hidden');selected.classList.add('block');}
            if(this.currentView==='m3'&&tabId==='labs'){tokenLab.ensureCharts();tokenLab.calc();}
            if(this.currentView==='m6'&&tabId==='labs'){defiCharts.ensure();poolLab.renderChart();ilLab.calc();}
            if(this.currentView==='m7'&&tabId==='labs'){stableCharts.ensure();depegLab.redraw();}
        }
    };

    /* ---------- M1 ---------- */
    const m1lab = {
        bind() {
            const inp = document.getElementById('m1-hash-in');
            if (inp) { inp.addEventListener('input', e => this.hash(e.target.value)); this.hash(inp.value); }
        },
        async hash(text) {
            const out = document.getElementById('m1-hash-out');
            if (!out) return;
            if (!text) { out.innerText = '—'; return; }
            if (!crypto?.subtle) { out.innerText = 'Web Crypto indisponível neste contexto.'; return; }
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
            out.innerText = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        },
        rnd(n) { return [...Array(n)].map(() => Math.floor(Math.random() * 16).toString(16)).join(''); },
        genKeys() {
            document.getElementById('m1-priv').innerText = '0x' + this.rnd(64);
            document.getElementById('m1-pub').innerText = '04' + this.rnd(120);
            document.getElementById('m1-sign-out').classList.add('hidden');
        },
        sign() {
            const priv = document.getElementById('m1-priv').innerText;
            if (priv.startsWith('[gere')) { alert('Gere um par de chaves primeiro.'); return; }
            const so = document.getElementById('m1-sign-out');
            so.innerHTML = 'Representação fictícia de assinatura, sem validade criptográfica: <span class="lab-mono break-all">0x' + this.rnd(64) + '</span>';
            so.classList.remove('hidden');
        }
    };

    /* ---------- M2 Blockchain ---------- */
    const chainLab = {
        chain: [], mempool: [], DIFF: '00', mining: false, blockCounter: 0, epoch: 0,
        init() {
            this.epoch++;this.chain = []; this.mempool = []; this.mining = false; this.blockCounter = 0;
            const now = new Date();
            const mk = (idx, txs, prevHash) => ({ index: idx, timestamp: now.toLocaleTimeString('pt-BR'), txs, prevHash, nonce: 0, hash: '' });
            const strOf = (b, n) => b.index + '|' + b.timestamp + '|' + JSON.stringify(b.txs) + '|' + b.prevHash + '|' + n;
            const g = mk(0, [{ from: 'GÊNESIS', to: '—', amount: 0 }], '0'.repeat(64));
            let r = mineSync(strOf(g, ''), this.DIFF); g.nonce = r.nonce; g.hash = r.hash;
            this.chain.push(g);
            const b1 = mk(1, [{ from: 'Alice', to: 'Bruno', amount: 2.5 }, { from: 'Carla', to: 'Diego', amount: 0.8 }], g.hash);
            r = mineSync(strOf(b1, ''), this.DIFF); b1.nonce = r.nonce; b1.hash = r.hash;
            this.chain.push(b1);
            this.blockCounter = 1;
            this.mempool = [{ from: 'Elena', to: 'Felipe', amount: 1.2 }, { from: 'Gustavo', to: 'Helena', amount: 3.4 }];
            this.strOf = strOf;
            this.render();
        },
        validate() {
            let prevOk = true;
            this.chain.forEach((b, i) => {
                b._tampered = !b.hash.startsWith(this.DIFF) || blockHash(this.strOf(b, b.nonce)) !== b.hash;
                b._broken = i > 0 && b.prevHash !== this.chain[i - 1].hash;
                b._valid = !b._tampered && !b._broken && prevOk;
                prevOk = b._valid;
            });
            return this.chain.every(b => b._valid);
        },
        render() {
            const wrap = document.getElementById('chain-wrap');
            if (!wrap) return;
            wrap.innerHTML = '';
            this.chain.forEach((b, i) => {
                wrap.appendChild(this.cardHTML(b, i));
                if (i < this.chain.length - 1) {
                    const c = document.createElement('div');
                    c.className = 'flex items-center px-1 text-atlas-muted';
                    c.innerHTML = '<i data-lucide="link" class="w-5 h-5" id="conn-' + i + '"></i>';
                    wrap.appendChild(c);
                }
            });
            lucide.createIcons();
            this.renderMempool();
            this.refreshStatus();
        },
        cardHTML(b, i) {
            const div = document.createElement('div');
            div.id = 'card-' + i;
            div.className = 'bg-atlas-bg border-2 rounded-xl p-4 w-72 shrink-0 transition-colors border-atlas-border';
            div.innerHTML = `
                <div class="flex items-center justify-between mb-2"><span class="text-white font-bold text-sm">⛓ BLOCO #${b.index}</span><span id="badge-${i}" class="text-[10px] px-2 py-0.5 rounded-full font-bold"></span></div>
                <div class="text-[10px] text-atlas-muted mb-2 flex justify-between"><span>⏱ ${b.timestamp}</span><span>nonce: <span id="nonce-${i}" class="lab-mono text-white">${b.nonce}</span></span></div>
                <div class="space-y-1 mb-3">${b.txs.map((tx, ti) => `<div class="flex items-center gap-1 text-[10px]"><input class="tx-in" value="${academy.escape(tx.from)}" onchange="chainLab.editTx(${i},${ti},'from',this.value)"><span class="text-atlas-muted">→</span><input class="tx-in" value="${academy.escape(tx.to)}" onchange="chainLab.editTx(${i},${ti},'to',this.value)"><input class="tx-in" style="width:44px" value="${tx.amount}" onchange="chainLab.editTx(${i},${ti},'amount',this.value)"></div>`).join('')}</div>
                <div class="text-[9px] text-atlas-muted">hash</div>
                <div id="hash-${i}" class="lab-mono text-[9px] break-all mb-3"></div>
                <button onclick="chainLab.mineBlock(${i})" id="mine-btn-${i}" class="w-full bg-atlas-card hover:bg-atlas-border border border-atlas-border text-atlas-muted hover:text-white py-1.5 rounded text-[11px] font-medium transition-colors">⛏ Reminerar</button>
                <div id="mine-status-${i}" class="text-[10px] text-yellow-400 lab-mono mt-2 text-center hidden"></div>`;
            return div;
        },
        refreshStatus() {
            const allValid = this.validate();
            this.chain.forEach((b, i) => {
                const card = document.getElementById('card-' + i);
                const badge = document.getElementById('badge-' + i);
                const hashEl = document.getElementById('hash-' + i);
                if (!card) return;
                hashEl.innerText = b.hash;
                if (b._tampered) {
                    card.className = 'bg-atlas-bg border-2 rounded-xl p-4 w-72 shrink-0 border-yellow-500/70';
                    hashEl.className = 'lab-mono text-[9px] break-all mb-3 text-yellow-400';
                    badge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-yellow-500/10 text-yellow-400 border border-yellow-500/40';
                    badge.innerText = '⚠ HASH ALTERADO';
                } else if (!b._valid) {
                    card.className = 'bg-atlas-bg border-2 rounded-xl p-4 w-72 shrink-0 border-red-500/70';
                    hashEl.className = 'lab-mono text-[9px] break-all mb-3 text-red-400';
                    badge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-red-500/10 text-red-400 border border-red-500/40';
                    badge.innerText = '✖ ELO QUEBRADO';
                } else {
                    card.className = 'bg-atlas-bg border-2 rounded-xl p-4 w-72 shrink-0 border-green-500/50';
                    hashEl.className = 'lab-mono text-[9px] break-all mb-3 text-green-400';
                    badge.className = 'text-[10px] px-2 py-0.5 rounded-full font-bold bg-green-500/10 text-green-400 border border-green-500/40';
                    badge.innerText = '✔ VÁLIDO';
                }
                const conn = document.getElementById('conn-' + i);
                if (conn) conn.classList.toggle('conn-broken', !this.chain[i + 1]._valid);
            });
            const pill = document.getElementById('chain-status-pill');
            if (pill) {
                if (allValid) { pill.className = 'px-2 py-1 rounded bg-green-500/10 border border-green-500/30 text-green-400 font-semibold text-xs'; pill.innerText = 'CADEIA VÁLIDA'; }
                else { pill.className = 'px-2 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-400 font-semibold text-xs'; pill.innerText = 'CADEIA INVÁLIDA'; }
            }
        },
        editTx(bi, ti, field, value) {
            const b = this.chain[bi];
            b.txs[ti][field] = field === 'amount' ? parseFloat(value) || value : value;
            // Keep the committed hash: changing data must invalidate the existing proof.
            this.refreshStatus();
        },
        mineBlock(i) {
            if (this.mining) return;
            this.mining = true;
            const b = this.chain[i];
            if (i > 0) b.prevHash = this.chain[i - 1].hash;
            const status = document.getElementById('mine-status-' + i);
            const btn = document.getElementById('mine-btn-' + i);
            btn.disabled = true; btn.classList.add('opacity-40');
            status.classList.remove('hidden');
            document.getElementById('card-' + i).classList.add('mining-pulse');
            let nonce = 0;
            const epoch = this.epoch;
            const tick = () => {
                if (app.currentView !== 'm2' || epoch !== this.epoch) { this.mining = false; return; }
                for (let k = 0; k < 40; k++) {
                    const h = blockHash(this.strOf(b, nonce));
                    if (h.startsWith(this.DIFF)) {
                        b.nonce = nonce; b.hash = h;
                        status.classList.add('hidden');
                        document.getElementById('card-' + i).classList.remove('mining-pulse');
                        btn.disabled = false; btn.classList.remove('opacity-40');
                        const nEl = document.getElementById('nonce-' + i);
                        if (nEl) nEl.innerText = nonce;
                        this.mining = false;
                        this.refreshStatus();
                        return;
                    }
                    nonce++;
                }
                status.innerText = '⛏ minerando… nonce ' + nonce;
                setTimeout(tick, 16);
            };
            tick();
        },
        async repairAll() {
            if (this.mining) return;
            const epoch = this.epoch;
            for (let i = 0; i < this.chain.length; i++) {
                if (app.currentView !== 'm2' || epoch !== this.epoch) return;
                if (!this.chain[i]._valid) {
                    await new Promise(res => {
                        const b = this.chain[i];
                        setTimeout(() => {
                            if (app.currentView !== 'm2' || epoch !== this.epoch) { res(); return; }
                            if (i > 0) b.prevHash = this.chain[i - 1].hash;
                            const repaired = mineSync(this.strOf(b, ''), this.DIFF);
                            b.nonce = repaired.nonce; b.hash = repaired.hash;
                            const nEl = document.getElementById('nonce-' + i);
                            if (nEl) nEl.innerText = repaired.nonce;
                            this.refreshStatus(); res();
                        }, 150);
                    });
                }
            }
        },
        renderMempool() {
            const list = document.getElementById('mempool-list');
            if (!list) return;
            if (!this.mempool.length) { list.innerHTML = '<div class="text-xs text-atlas-muted italic">Mempool vazia.</div>'; return; }
            list.innerHTML = this.mempool.map((tx, i) => `<div class="flex items-center gap-2 text-xs bg-atlas-card border border-atlas-border rounded px-3 py-2"><span class="text-white">${academy.escape(tx.from)}</span><span class="text-atlas-muted">→</span><span class="text-white">${academy.escape(tx.to)}</span><span class="text-blue-400 lab-mono ml-auto">${tx.amount} ATLAS</span><button onclick="chainLab.removeTx(${i})" class="text-atlas-muted hover:text-red-400">✕</button></div>`).join('');
        },
        addRandomTx() {
            const names = ['Alice', 'Bruno', 'Carla', 'Diego', 'Elena', 'Felipe', 'Gustavo', 'Helena'];
            const a = names[Math.floor(Math.random() * names.length)];
            let b = names[Math.floor(Math.random() * names.length)];
            if (a === b) b = names[(names.indexOf(a) + 1) % names.length];
            this.mempool.push({ from: a, to: b, amount: +(Math.random() * 5).toFixed(2) });
            this.renderMempool();
        },
        removeTx(i) { this.mempool.splice(i, 1); this.renderMempool(); },
        createBlock() {
            if (this.mining || !this.mempool.length) return;
            const last = this.chain[this.chain.length - 1];
            this.blockCounter++;
            const nb = { index: this.blockCounter, timestamp: new Date().toLocaleTimeString('pt-BR'), txs: this.mempool.slice(), prevHash: last.hash, nonce: 0, hash: blockHash(this.strOf({ index: this.blockCounter, timestamp: '', txs: [], prevHash: last.hash }, 0)) };
            this.chain.push(nb);
            this.mempool = [];
            this.render();
            const el = document.getElementById('chain-wrap');
            el.scrollLeft = el.scrollWidth;
            this.mineBlock(this.chain.length - 1);
        }
    };

    /* ---------- M3 Tokenomics ---------- */
    const tokenLab = {
        distChart: null, chartsReady: false,
        read() {
            const price = parseFloat(document.getElementById('tok-price').value) || 0;
            const supply = parseFloat(document.getElementById('tok-supply').value) || 0;
            let circ = parseFloat(document.getElementById('tok-circ').value) || 0;
            const burn = parseFloat(document.getElementById('tok-burn').value) || 0;
            if (circ > supply) circ = supply;
            return { price, supply, circ, burn };
        },
        calc() {
            const d = this.read();
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            const mcap = d.circ * d.price;
            const fdv = d.supply * d.price;
            setTxt('out-mcap', fmtUSD(mcap));
            setTxt('out-fdv', fmtUSD(fdv));
            const circPct = d.supply > 0 ? (d.circ / d.supply) * 100 : 0;
            setTxt('dist-circ-pct', circPct.toFixed(1) + '%');
            setTxt('dist-lock-pct', (100 - circPct).toFixed(1) + '%');
            const ratio = mcap > 0 ? fdv / mcap : 0;
            setTxt('out-ratio', ratio ? ratio.toFixed(2) + '×' : '—');
            const ratioMsg = document.getElementById('out-ratio-msg');
            if (ratioMsg) {
                if (ratio <= 1.01) ratioMsg.innerText = '✅ Sem diluição futura relevante.';
                else if (ratio < 2) ratioMsg.innerText = '🟡 Diluição moderada.';
                else ratioMsg.innerText = '🔴 Alta diluição futura.';
            }
            setTxt('burn-label', d.burn + '%');
            const newSupply = d.supply * (1 - d.burn / 100);
            setTxt('burn-supply', fmtNum(newSupply));
            setTxt('burn-fdv', fmtUSD(newSupply * d.price));
            setTxt('burn-price', d.burn > 0 && newSupply > 0 && d.circ > 0 ? fmtUSD(mcap / Math.min(newSupply, d.circ)) : '—');
            const multipliers = [0.5, 1, 2, 5, 10];
            const refs = [{ name: 'Bitcoin', val: 1.3e12 }, { name: 'Ethereum', val: 4e11 }];
            const tbody = document.getElementById('scen-table');
            if (tbody) {
                tbody.innerHTML = multipliers.map(m => {
                    const v = mcap * m;
                    let comp = '—';
                    for (const rf of refs) {
                        if (v >= rf.val) { comp = '🏆 supera ' + rf.name; break; }
                        else if (v >= rf.val * 0.1) { comp = (v / rf.val * 100).toFixed(1) + '% do ' + rf.name; break; }
                    }
                    return `<tr class="text-atlas-muted border-b border-atlas-border/40"><td class="py-2 pr-2">${m}×</td><td class="py-2 pr-2">${fmtUSD(d.price * m)}</td><td class="py-2 pr-2 text-white">${fmtUSD(v)}</td><td class="py-2 text-[10px]">${comp}</td></tr>`;
                }).join('');
            }
            if (this.distChart) { this.distChart.data.datasets[0].data = [circPct, 100 - circPct]; this.distChart.update(); }
        },
        ensureCharts() {
            if (this.chartsReady) { this.calc(); return; }
            const dc = document.getElementById('distChart');
            if (!dc) return;
            this.chartsReady = true;
            this.distChart = new Chart(dc, {
                type: 'doughnut',
                data: { labels: ['Em circulação', 'Bloqueado'], datasets: [{ data: [40, 60], backgroundColor: ['#4ade80', '#475569'], borderColor: '#151e32', borderWidth: 3 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '62%', plugins: { legend: { display: false } } }
            });
            this.calc();
        }
    };

    /* ---------- M4 Explorador Bitcoin ---------- */
    const btcLab = {
        blocks: [], txIndex: {}, outpoint: {}, selBlock: 1001, selTx: 'tx1',
        shortHash(s) { return atlasHash(s).slice(0, 16) + '…'; },
        blockHashStr(h) { return '0000000000000000000' + atlasHash('blk' + h).slice(0, 13); },
        init() {
            const mkTx = (id, coinbase, inputs, outputs) => {
                const inSum = inputs.reduce((s, i) => s + i.amt, 0);
                const outSum = outputs.reduce((s, o) => s + o.amt, 0);
                return { id, coinbase, inputs, outputs, fee: coinbase ? null : +(inSum - outSum).toFixed(4) };
            };
            this.blocks = [
                { height: 1000, time: '08:47:12', txs: [mkTx('cb1000', true, [], [{ o: 'Alice', amt: 3.0 }, { o: 'Carla', amt: 3.25 }])]},
                { height: 1001, time: '08:58:31', txs: [
                    mkTx('cb1001', true, [], [{ o: 'Miner', amt: 6.25 }]),
                    mkTx('tx1', false, [{ ref: 'cb1000:0', amt: 3.0 }], [{ o: 'Bruno', amt: 1.2 }, { o: 'Alice', amt: 1.798 }]),
                    mkTx('tx2', false, [{ ref: 'cb1000:1', amt: 3.25 }], [{ o: 'Diego', amt: 2.5 }, { o: 'Carla', amt: 0.745 }])
                ]},
                { height: 1002, time: '09:07:55', txs: [
                    mkTx('cb1002', true, [], [{ o: 'Miner', amt: 6.25 }]),
                    mkTx('tx3', false, [{ ref: 'tx1:0', amt: 1.2 }, { ref: 'tx2:0', amt: 2.5 }], [{ o: 'Elena', amt: 3.694 }]),
                    mkTx('tx4', false, [{ ref: 'tx1:1', amt: 1.798 }], [{ o: 'Felipe', amt: 0.5 }, { o: 'Alice', amt: 1.296 }])
                ]},
                { height: 1003, time: '09:21:03', txs: [
                    mkTx('cb1003', true, [], [{ o: 'Miner', amt: 6.25 }]),
                    mkTx('tx5', false, [{ ref: 'tx3:0', amt: 3.694 }], [{ o: 'Alice', amt: 1.0 }, { o: 'Elena', amt: 2.69 }]),
                    mkTx('tx6', false, [{ ref: 'tx4:0', amt: 0.5 }], [{ o: 'Bruno', amt: 0.498 }])
                ]}
            ];
            this.txIndex = {}; this.outpoint = {};
            this.blocks.forEach(bl => bl.txs.forEach(tx => {
                this.txIndex[tx.id] = { height: bl.height, tx };
                tx.outputs.forEach((out, vi) => { this.outpoint[tx.id + ':' + vi] = { owner: out.o, amt: out.amt, spentBy: null }; });
            }));
            this.blocks.forEach(bl => bl.txs.forEach(tx => {
                tx.inputs.forEach(inp => { const op = this.outpoint[inp.ref]; if (op) op.spentBy = tx.id; });
            }));
            this.selBlock = 1001; this.selTx = 'tx1';
            this.render();
        },
        blockAt(h) { return this.blocks.find(b => b.height === h); },
        curTx() { return this.txIndex[this.selTx] ? this.txIndex[this.selTx].tx : null; },
        render() { this.renderBlocks(); this.renderTxList(); this.renderDetail(); this.renderUtxos(); },
        renderBlocks() {
            const wrap = document.getElementById('btc-blocks');
            if (!wrap) return;
            wrap.innerHTML = this.blocks.map(b => {
                const fees = b.txs.reduce((s, t) => s + (t.fee || 0), 0);
                const sel = b.height === this.selBlock;
                return `<div onclick="btcLab.pickBlock(${b.height})" class="blk-card ${sel ? 'sel' : ''} bg-atlas-bg border-2 ${sel ? 'border-orange-500' : 'border-atlas-border'} rounded-xl p-4">
                    <div class="flex items-center justify-between"><span class="text-white font-bold text-sm">#${b.height.toLocaleString('pt-BR')}</span>${sel ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/40 font-bold">SELECIONADO</span>' : ''}</div>
                    <div class="lab-mono text-[9px] text-atlas-muted mt-1 break-all">${this.blockHashStr(b.height)}</div>
                    <div class="flex justify-between mt-2 text-[10px]"><span class="text-atlas-muted">⏱ ${b.time}</span><span class="text-atlas-muted">${b.txs.length} txs</span></div>
                    <div class="text-[10px] text-yellow-400 mt-1">fees: ${fees.toFixed(4)} BTC</div>
                </div>`;
            }).join('');
        },
        pickBlock(h) { this.selBlock = h; this.selTx = this.blockAt(h).txs[0].id; this.render(); },
        renderTxList() {
            const wrap = document.getElementById('btc-txlist');
            if (!wrap) return;
            const bl = this.blockAt(this.selBlock);
            wrap.innerHTML = bl.txs.map(tx => {
                const sel = tx.id === this.selTx;
                const total = tx.outputs.reduce((s, o) => s + o.amt, 0);
                return `<div onclick="btcLab.pickTx('${tx.id}')" class="txrow ${sel ? 'sel' : ''} bg-atlas-bg border ${sel ? 'border-orange-500' : 'border-atlas-border'} rounded-lg px-4 py-3 flex flex-wrap items-center gap-3">
                    <span class="lab-mono text-xs text-white">${this.shortHash(tx.id)}</span>
                    ${tx.coinbase ? '<span class="text-[9px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/40 font-bold">⛏ COINBASE</span>' : `<span class="text-[10px] text-atlas-muted">${tx.inputs.length} input${tx.inputs.length > 1 ? 's' : ''} → ${tx.outputs.length} outputs</span>`}
                    <span class="text-[10px] text-blue-400 lab-mono ml-auto">${total.toFixed(4)} BTC</span>
                    <span class="text-[10px] ${tx.coinbase ? 'text-atlas-muted' : 'text-orange-400'} lab-mono">${tx.coinbase ? 'emissão' : 'fee ' + tx.fee.toFixed(4)}</span>
                </div>`;
            }).join('');
        },
        pickTx(id) { this.selTx = id; this.renderTxList(); this.renderDetail(); this.renderUtxos(); },
        renderDetail() {
            const wrap = document.getElementById('btc-detail');
            if (!wrap) return;
            const tx = this.curTx();
            if (!tx) { wrap.innerHTML = ''; return; }
            const inputCol = tx.coinbase
                ? `<div class="flex-1 min-w-[220px]"><div class="text-[10px] font-bold text-atlas-muted uppercase mb-2">Inputs</div><div class="p-4 bg-yellow-900/10 border border-yellow-500/30 rounded-lg text-sm text-yellow-400">⛏ Nenhum input — cria novas moedas.</div></div>`
                : `<div class="flex-1 min-w-[220px]"><div class="text-[10px] font-bold text-red-400 uppercase mb-2">Inputs (UTXOs consumidos)</div><div class="space-y-2">${tx.inputs.map(inp => {
                    const op = this.outpoint[inp.ref];
                    const origin = this.txIndex[inp.ref.split(':')[0]];
                    return `<div class="p-3 bg-red-900/10 border border-red-500/30 rounded-lg">
                        <div class="flex justify-between items-center"><span class="text-white text-sm font-semibold">${op ? op.owner : '?'}</span><span class="lab-mono text-sm text-red-400 font-bold">${inp.amt.toFixed(4)} BTC</span></div>
                        <div class="text-[10px] text-atlas-muted mt-1">origem: tx ${this.shortHash(inp.ref.split(':')[0])} · bloco #${origin ? origin.height.toLocaleString('pt-BR') : '?'}</div>
                    </div>`; }).join('')}</div></div>`;
            const outputCol = `<div class="flex-1 min-w-[220px]"><div class="text-[10px] font-bold text-green-400 uppercase mb-2">Outputs (novos UTXOs)</div><div class="space-y-2">${tx.outputs.map((out, vi) => {
                const op = this.outpoint[tx.id + ':' + vi];
                const spent = op && op.spentBy;
                const spentInfo = spent ? this.txIndex[spent] : null;
                return `<div class="p-3 bg-green-900/10 border border-green-500/30 rounded-lg">
                    <div class="flex justify-between items-center"><span class="text-white text-sm font-semibold">${out.o}</span><span class="lab-mono text-sm text-green-400 font-bold">${out.amt.toFixed(4)} BTC</span></div>
                    ${spent
                        ? `<div class="text-[10px] text-red-400 mt-1">↳ gasto na tx ${this.shortHash(spent)} · bloco #${spentInfo.height.toLocaleString('pt-BR')}</div>`
                        : `<div class="text-[10px] text-green-400 mt-1">● NÃO GASTO — ainda é um UTXO</div>`}
                </div>`; }).join('')}</div></div>`;
            const midCol = tx.coinbase
                ? `<div class="flex flex-col items-center justify-center px-2 py-4 text-center"><i data-lucide="arrow-right" class="text-yellow-400 w-6 h-6"></i><div class="text-[10px] text-yellow-400 font-bold mt-2 px-2 py-1 rounded bg-yellow-500/10 border border-yellow-500/30">EMISSÃO</div></div>`
                : `<div class="flex flex-col items-center justify-center px-2 py-4 text-center"><i data-lucide="arrow-right" class="text-orange-400 w-6 h-6"></i><div class="text-[10px] text-orange-400 font-bold mt-2 px-2 py-1 rounded bg-orange-500/10 border border-orange-500/30">FEE<br>${tx.fee.toFixed(4)} BTC</div></div>`;
            wrap.innerHTML = `<div class="flex items-center justify-between mb-4 flex-wrap gap-2"><div><span class="lab-mono text-white text-sm">${this.shortHash(tx.id)}</span><span class="text-atlas-muted text-xs ml-2">bloco #${this.selBlock.toLocaleString('pt-BR')}</span></div></div>
                <div class="flex flex-col md:flex-row gap-3 items-stretch">${inputCol}${midCol}${outputCol}</div>`;
            const bal = document.getElementById('btc-balance');
            if (bal) {
                if (tx.coinbase) {
                    const tot = tx.outputs.reduce((s, o) => s + o.amt, 0);
                    bal.innerHTML = `<div class="text-xs text-atlas-muted">⛏ <strong class="text-white">Coinbase:</strong> <span class="lab-mono text-yellow-400">${tot.toFixed(4)} BTC</span> emitidos.</div>`;
                } else {
                    const inS = tx.inputs.reduce((s, i) => s + i.amt, 0);
                    const outS = tx.outputs.reduce((s, o) => s + o.amt, 0);
                    const feeW = Math.max((tx.fee / inS) * 100, 4);
                    bal.innerHTML = `
                        <div class="text-xs text-atlas-muted mb-2"><strong class="text-white">Equação:</strong> <span class="lab-mono text-red-400">${inS.toFixed(4)}</span> = <span class="lab-mono text-green-400">${outS.toFixed(4)}</span> + <span class="lab-mono text-orange-400">${tx.fee.toFixed(4)}</span> (fee)</div>
                        <div class="w-full h-4 rounded-full overflow-hidden flex border border-atlas-border"><div class="bg-green-500/70 h-full" style="width:${100 - feeW}%"></div><div class="bg-orange-500 h-full" style="width:${feeW}%"></div></div>`;
                }
            }
            lucide.createIcons();
        },
        renderUtxos() {
            const wrap = document.getElementById('btc-utxos');
            if (!wrap) return;
            const tx = this.curTx();
            const consumed = new Set(tx ? tx.inputs.map(i => i.ref) : []);
            const createdPrefix = tx ? tx.id + ':' : null;
            const set = {};
            this.blocks.filter(b => b.height <= this.selBlock).forEach(b => b.txs.forEach(t => {
                t.inputs.forEach(i => delete set[i.ref]);
                t.outputs.forEach((o, vi) => { set[t.id + ':' + vi] = { owner: o.o, amt: o.amt, h: b.height }; });
            }));
            const rows = [];
            consumed.forEach(ref => {
                const op = this.outpoint[ref];
                if (op) rows.push({ ref, owner: op.owner, amt: op.amt, h: this.txIndex[ref.split(':')[0]].height, state: 'consumed' });
            });
            Object.keys(set).forEach(ref => {
                const u = set[ref];
                rows.push({ ref, owner: u.owner, amt: u.amt, h: u.h, state: createdPrefix && ref.startsWith(createdPrefix) ? 'created' : 'neutral' });
            });
            rows.sort((a, b) => a.h - b.h);
            wrap.innerHTML = `
                <table class="w-full text-xs text-left min-w-[560px]">
                    <thead><tr class="text-atlas-muted border-b border-atlas-border"><th class="py-2 pr-2">UTXO</th><th class="py-2 pr-2">Dono</th><th class="py-2 pr-2">Bloco</th><th class="py-2 pr-2 text-right">Valor</th><th class="py-2 text-right">Estado</th></tr></thead>
                    <tbody class="lab-mono">${rows.map(r => `
                        <tr class="border-b border-atlas-border/40 ${r.state === 'consumed' ? 'text-red-400/80 line-through opacity-70' : r.state === 'created' ? 'text-green-400' : 'text-atlas-muted'}">
                            <td class="py-2 pr-2">${this.shortHash(r.ref.split(':')[0])}:#${r.ref.split(':')[1]}</td>
                            <td class="py-2 pr-2">${r.owner}</td>
                            <td class="py-2 pr-2">#${r.h.toLocaleString('pt-BR')}</td>
                            <td class="py-2 pr-2 text-right">${r.amt.toFixed(4)}</td>
                            <td class="py-2 text-right">${r.state === 'consumed' ? '🔴 gasto nesta tx' : r.state === 'created' ? '🟢 criado nesta tx' : '● não gasto'}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>`;
        }
    };

    /* ---------- M5 Cofre ---------- */
    const web5 = {
        deployed: false, busy: false, txTimer: null,
        state: null, txs: [],
        ADDR: { Alice: '0xA11ce00000000000000000000000000000000042', Bruno: '0xB0b0000000000000000000000000000000000077' },
        GAS: { deploy: 320000, deposit: 45210, withdraw: 52300, setLocker: 28400 },
        BASE_GWEI: 18,
        codeSource() {
            return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract Cofre {
    address public owner;
    address public locker;
    mapping(address => uint256) public saldos;

    event Depositou(address indexed quem, uint256 valor);
    event Sacou(address indexed quem, uint256 valor);
    event LockerDefinido(address novo);

    constructor() { owner = msg.sender; }

    modifier onlyOwner() {
        require(msg.sender == owner, "nao autorizado");
        _;
    }

    function deposit() external payable {
        require(msg.value > 0, "valor invalido");
        saldos[msg.sender] += msg.value;
        emit Depositou(msg.sender, msg.value);
    }

    function withdraw() external {
        uint256 valor = saldos[msg.sender];
        require(valor > 0, "sem saldo");
        saldos[msg.sender] = 0;
        payable(msg.sender).transfer(valor);
        emit Sacou(msg.sender, valor);
    }

    function setLocker(address novo) external onlyOwner {
        locker = novo;
        emit LockerDefinido(novo);
    }

    function getBalance() external view returns (uint256) {
        return saldos[msg.sender];
    }
}`;
        },
        init() {
            this.state = { owner: null, locker: null, balances: { Alice: 0, Bruno: 0 }, vault: 0, block: 19845001 };
            this.deployed = false; this.busy = false; this.txs = [];
            const codeEl = document.getElementById('w5-code');
            if (codeEl) codeEl.innerText = this.codeSource();
            this.render();
        },
        log(msg, cls) {
            const el = document.getElementById('w5-log');
            if (!el) return;
            el.innerHTML += `<br><span class="${cls || 'text-green-400'}">> ${msg}</span>`;
            el.scrollTop = el.scrollHeight;
        },
        sender() { const s = document.getElementById('w5-sender'); return s ? s.value : 'Alice'; },
        shortAddr(a) { return a ? a.slice(0, 6) + '…' + a.slice(-4) : '—'; },
        render() {
            const st = this.state;
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            setTxt('w5-st-owner', this.deployed ? this.shortAddr(st.owner) : '—');
            setTxt('w5-st-locker', this.deployed ? (st.locker ? this.shortAddr(st.locker) : '(vazio)') : '—');
            setTxt('w5-st-alice', (st.balances.Alice || 0).toFixed(3) + ' ETH');
            setTxt('w5-st-bruno', (st.balances.Bruno || 0).toFixed(3) + ' ETH');
            setTxt('w5-st-vault', (st.vault || 0).toFixed(3) + ' ETH');
            setTxt('w5-st-block', '#' + (st.block ? st.block.toLocaleString('pt-BR') : '—'));
            const badge = document.getElementById('w5-deploy-badge');
            if (badge) {
                badge.innerText = this.deployed ? '✔ IMPLANTADO' : 'NÃO IMPLANTADO';
                badge.className = this.deployed
                    ? 'text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/30 font-bold'
                    : 'text-[10px] px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 font-bold';
            }
            ['w5-fn-deposit', 'w5-fn-withdraw', 'w5-fn-locker'].forEach(id => {
                const b = document.getElementById(id);
                if (b) b.disabled = !this.deployed || this.busy;
            });
            const li = document.getElementById('w5-locker-info');
            if (li) li.innerText = this.deployed && st.owner ? '💡 owner atual: ' + (st.owner === this.ADDR.Alice ? 'Alice' : 'Bruno') + ' — só o owner chama setLocker().' : '';
            const txList = document.getElementById('w5-txlist');
            if (txList) {
                if (!this.txs.length) txList.innerHTML = '<div class="text-atlas-muted italic">Nenhuma transação ainda.</div>';
                else txList.innerHTML = this.txs.slice().reverse().map(t => `
                    <div class="flex items-center gap-2 p-2 rounded border ${t.status === 'pendente' ? 'border-yellow-500/40 bg-yellow-900/10' : t.status === 'revert' ? 'border-red-500/40 bg-red-900/10' : 'border-green-500/40 bg-green-900/10'}">
                        <span class="lab-mono text-[10px] text-atlas-muted">${t.hash}</span>
                        <span class="text-white">${t.label}</span>
                        <span class="text-atlas-muted">· ${t.gas.toLocaleString('pt-BR')} gas</span>
                        <span class="ml-auto text-[10px] font-bold ${t.status === 'pendente' ? 'text-yellow-400' : t.status === 'revert' ? 'text-red-400' : 'text-green-400'}">
                            ${t.status === 'pendente' ? '⏳ PENDENTE' : t.status === 'revert' ? '✖ REVERT' : '✔ BLOCO #' + t.block}
                        </span>
                    </div>`).join('');
            }
            lucide.createIcons();
        },
        gasPreviewFor(fn) {
            const gas = this.GAS[fn] || 21000;
            const costEth = gas * this.BASE_GWEI / 1e9;
            return `gas estimado: <span class="text-yellow-400">${gas.toLocaleString('pt-BR')}</span> · preço: ${this.BASE_GWEI} Gwei · custo ≈ <span class="text-orange-400">${costEth.toFixed(6)} ETH</span>`;
        },
        simulateTx(label, fn, apply, failMsg) {
            if (!this.deployed || this.busy) return;
            if (failMsg) {
                const gas = this.GAS[fn];
                this.txs.push({ hash: '0x' + atlasHash(Math.random() + '').slice(0, 10), label, gas, status: 'revert', block: '—' });
                this.log(`✖ revert: ${failMsg} (${gas.toLocaleString('pt-BR')} gas consumidos)`, 'text-red-400');
                this.render();
                return;
            }
            this.busy = true;
            this.render();
            const gas = this.GAS[fn];
            const tx = { hash: '0x' + atlasHash(Math.random() + '').slice(0, 10), label, gas, status: 'pendente', block: null };
            this.txs.push(tx);
            this.log(`📡 tx ${tx.hash} assinada por ${this.sender()} e enviada ao mempool…`, 'text-blue-400');
            this.render();
            this.txTimer = setTimeout(() => {
                this.state.block += 1;
                tx.status = 'ok';
                tx.block = this.state.block.toLocaleString('pt-BR');
                apply();
                this.busy = false;
                this.render();
            }, 1100);
        },
        deploy() {
            if (this.deployed || this.busy) return;
            this.busy = true;
            this.render();
            const tx = { hash: '0x' + atlasHash('deploy').slice(0, 10), label: 'deploy(Cofre)', gas: this.GAS.deploy, status: 'pendente', block: null };
            this.txs.push(tx);
            this.log('🚀 compilando Cofre.sol → bytecode EVM…', 'text-purple-400');
            this.render();
            this.txTimer = setTimeout(() => {
                this.state.block += 1;
                this.state.owner = this.ADDR.Alice;
                this.deployed = true;
                tx.status = 'ok';
                tx.block = this.state.block.toLocaleString('pt-BR');
                this.log('✅ contrato implantado · owner = Alice (deployer)', 'text-green-400');
                this.busy = false;
                this.render();
            }, 1400);
        },
        callFn(fn) {
            if (!this.deployed) { alert('Implante o contrato primeiro.'); return; }
            const who = this.sender();
            const whoAddr = this.ADDR[who];
            if (fn === 'getBalance') {
                const bal = this.state.balances[who] || 0;
                this.log(`👁 getBalance() → ${bal.toFixed(3)} ETH para ${who} (chamada local, 0 gas)`, 'text-cyan-400');
                return;
            }
            if (fn === 'deposit') {
                const amt = parseFloat(document.getElementById('w5-amount').value) || 0;
                if (amt <= 0) { alert('Informe um valor de depósito maior que zero.'); return; }
                this.simulateTx(`deposit() · ${amt} ETH`, 'deposit', () => {
                    this.state.balances[who] = (this.state.balances[who] || 0) + amt;
                    this.state.vault += amt;
                    this.log(`🟠 Depositou(quem: ${who}, valor: ${amt}) · saldo = ${this.state.balances[who].toFixed(3)} ETH`);
                }, null);
                return;
            }
            if (fn === 'withdraw') {
                const bal = this.state.balances[who] || 0;
                this.simulateTx('withdraw()', 'withdraw', () => {
                    this.state.balances[who] = 0;
                    this.state.vault -= bal;
                    this.log(`🟠 Sacou(quem: ${who}, valor: ${bal.toFixed(3)})`, 'text-green-400');
                }, bal <= 0 ? 'require falhou: "sem saldo"' : null);
                return;
            }
            if (fn === 'setLocker') {
                const isOwner = whoAddr === this.state.owner;
                this.simulateTx('setLocker(0xB0b…)', 'setLocker', () => {
                    this.state.locker = this.ADDR.Bruno;
                    this.log('🟠 LockerDefinido(novo: Bruno)', 'text-yellow-400');
                }, isOwner ? null : 'require falhou: "nao autorizado" (onlyOwner)');
                return;
            }
        }
    };
    document.addEventListener('mouseover', e => {
        const t = e.target;
        if (!t || !t.id) return;
        const map = { 'w5-fn-deposit': 'deposit', 'w5-fn-withdraw': 'withdraw', 'w5-fn-locker': 'setLocker', 'w5-btn-deploy': 'deploy' };
        if (map[t.id]) {
            const el = document.getElementById('w5-gas-preview');
            if (el) el.innerHTML = web5.gasPreviewFor(map[t.id]);
        }
    });

    /* ---------- M5 Gas ---------- */
    const gasLab = {
        calc() {
            const used = +document.getElementById('gas-used').value;
            const limit = +document.getElementById('gas-limit').value;
            const base = +document.getElementById('gas-base').value;
            const tip = +document.getElementById('gas-tip').value;
            const ethPrice = +document.getElementById('gas-eth-price').value || 0;
            document.getElementById('gas-used-label').innerText = used.toLocaleString('pt-BR');
            document.getElementById('gas-limit-label').innerText = limit.toLocaleString('pt-BR');
            document.getElementById('gas-base-label').innerText = base;
            document.getElementById('gas-tip-label').innerText = tip;
            const eff = base + tip;
            const costEth = used * eff / 1e9;
            document.getElementById('gas-eff').innerText = eff + ' Gwei';
            document.getElementById('gas-cost-eth').innerText = costEth.toFixed(6) + ' ETH';
            document.getElementById('gas-cost-usd').innerText = '≈ ' + fmtUSD(costEth * ethPrice);
            const pct = Math.min((used / limit) * 100, 100);
            document.getElementById('gas-pct').innerText = pct.toFixed(0) + '%';
            const meter = document.getElementById('gas-meter');
            meter.style.width = pct + '%';
            meter.className = 'h-full transition-all ' + (pct > 95 ? 'bg-red-500' : pct > 70 ? 'bg-orange-500' : 'bg-yellow-500');
            const verdict = document.getElementById('gas-verdict');
            if (used > limit) {
                verdict.className = 'p-3 rounded-lg text-sm bg-red-900/20 border border-red-500/30 text-red-400';
                verdict.innerHTML = '❌ <strong>Out of gas!</strong> A transação falha e o estado é revertido, mas a taxa é cobrada.';
            } else if (pct > 85) {
                verdict.className = 'p-3 rounded-lg text-sm bg-yellow-900/20 border border-yellow-500/30 text-yellow-400';
                verdict.innerHTML = '⚠️ Margem apertada — aumente o gas limit.';
            } else {
                verdict.className = 'p-3 rounded-lg text-sm bg-green-900/20 border border-green-500/30 text-green-400';
                verdict.innerHTML = '✅ Gas limit suficiente. Gas não utilizado é devolvido.';
            }
        }
    };

    /* ---------- M5 Construtor ---------- */
    const buildLab = {
        read() {
            const name = (document.getElementById('bc-name').value || 'MeuContrato').replace(/[^a-zA-Z0-9_]/g, '') || 'MeuContrato';
            const type = document.getElementById('bc-type').value;
            const varName = (document.getElementById('bc-var').value || 'valor').replace(/[^a-zA-Z0-9_]/g, '') || 'valor';
            const action = document.getElementById('bc-action').value;
            const fnName = (document.getElementById('bc-fn').value || 'ajustar').replace(/[^a-zA-Z0-9_]/g, '') || 'ajustar';
            const eventName = (document.getElementById('bc-event').value || 'Atualizado').replace(/[^a-zA-Z0-9_]/g, '') || 'Atualizado';
            return { name, type, varName, action, fnName, eventName };
        },
        defaultFor(type) {
            if (type === 'uint256') return '0';
            if (type === 'address') return 'address(0)';
            if (type === 'bool') return 'false';
            return '""';
        },
        generate(c) {
            const isSet = c.action === 'set';
            const body = c.action === 'increment' ? `        ${c.varName} += 1;` : c.action === 'decrement' ? `        ${c.varName} -= 1;` : `        ${c.varName} = novoValor;`;
            const sig = isSet ? `function ${c.fnName}(${c.type} novoValor) external` : `function ${c.fnName}() external`;
            return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ${c.name} {
    ${c.type} public ${c.varName} = ${this.defaultFor(c.type)};

    event ${c.eventName}(${c.type} ${isSet ? 'novoValor' : 'valorAtual'});

    ${sig} {
${body}
        emit ${c.eventName}(${isSet ? 'novoValor' : c.varName});
    }

    function consultar() external view returns (${c.type}) {
        return ${c.varName};
    }
}`;
        },
        update() {
            const el = document.getElementById('bc-code');
            if (el) el.innerText = this.generate(this.read());
        },
        deploy() {
            const c = this.read();
            const st = document.getElementById('bc-deploy-status');
            const btn = document.getElementById('bc-btn-deploy');
            if (!st || !btn) return;
            btn.disabled = true;
            st.classList.remove('hidden');
            st.className = 'p-3 rounded-lg text-sm bg-blue-900/20 border border-blue-500/30 text-blue-400';
            st.textContent = 'Simulando a implantação de ' + c.name + '.sol…';
            setTimeout(() => {
                const addr = '0x' + atlasHash(c.name + c.fnName).slice(0, 24);
                const gas = 280000 + c.fnName.length * 1200 + c.varName.length * 800;
                st.className = 'p-3 rounded-lg text-sm bg-green-900/20 border border-green-500/30 text-green-400';
                st.innerHTML = `🎉 <strong>${academy.escape(c.name)}</strong> simulado! Nenhum contrato foi compilado ou enviado à rede.<br><span class="lab-mono text-xs">endereço: ${addr.slice(0, 18)}…</span><br><span class="text-xs">gas do deploy: ${gas.toLocaleString('pt-BR')}</span>`;
                btn.disabled = false;
            }, 1200);
        }
    };

    /* ---------- M6 Pool ---------- */
    const poolLab = {
        x: 0, y: 0, x0: 0, y0: 0, k: 0, steps: [], fee: 0.003, lastImpact: null,
        create() {
            const a = parseFloat(document.getElementById('pl-eth').value) || 10;
            const p = parseFloat(document.getElementById('pl-price').value) || 2000;
            this.x0 = a; this.y0 = a * p;
            this.x = this.x0; this.y = this.y0;
            this.k = this.x * this.y;
            this.steps = [p]; this.lastImpact = null;
            this.log('💧 pool criado: ' + a.toLocaleString('pt-BR') + ' ETH a ' + fmtUSD(p));
            this.render(); this.renderChart();
        },
        price() { return this.y / this.x; },
        log(msg) {
            const el = document.getElementById('pl-log');
            if (!el) return;
            el.innerHTML += '<br>> ' + msg;
            el.scrollTop = el.scrollHeight;
        },
        swap() {
            const dir = document.getElementById('pl-dir').value;
            const amt = parseFloat(document.getElementById('pl-amt').value) || 0;
            if (amt <= 0) { alert('Informe uma quantidade para o swap.'); return; }
            const priceBefore = this.price();
            let label;
            if (dir === 'eth-usdc') {
                const dx = amt * (1 - this.fee);
                const newX = this.x + dx;
                const newY = this.k / newX;
                label = '🔄 ' + amt + ' ETH → ' + (this.y - newY).toFixed(2) + ' USDC';
                this.x = newX; this.y = newY;
            } else {
                const dy = amt * (1 - this.fee);
                const newY = this.y + dy;
                const newX = this.k / newY;
                label = '🔄 ' + amt + ' USDC → ' + (this.x - newX).toFixed(4) + ' ETH';
                this.x = newX; this.y = newY;
            }
            this.lastImpact = (this.price() / priceBefore - 1) * 100;
            this.steps.push(this.price());
            this.log(label + ' · impacto: ' + this.lastImpact.toFixed(2) + '%');
            this.render(); this.renderChart();
        },
        values() {
            const p = this.price();
            const lpValue = 2 * Math.sqrt(this.k * p);
            const hodl = this.x0 * p + this.y0;
            return { p, lpValue, hodl, il: lpValue / hodl - 1 };
        },
        render() {
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            setTxt('pl-x', this.x.toFixed(4) + ' ETH');
            setTxt('pl-y', this.y.toFixed(2) + ' USDC');
            setTxt('pl-price-now', fmtUSD(this.price()));
            setTxt('pl-k', this.k.toLocaleString('pt-BR', { maximumFractionDigits: 0 }));
            const v = this.values();
            setTxt('pl-value', fmtUSD(v.lpValue));
            setTxt('pl-lpval', fmtUSD(v.lpValue));
            setTxt('pl-hodl', fmtUSD(v.hodl));
            const impact = document.getElementById('pl-impact');
            if (impact) {
                if (this.lastImpact === null) { impact.innerText = '—'; impact.className = 'text-atlas-muted'; }
                else {
                    impact.innerText = this.lastImpact.toFixed(2) + '%';
                    impact.className = this.lastImpact >= 0 ? 'text-green-400' : 'text-red-400';
                }
            }
            const ilBadge = document.getElementById('pl-il-badge');
            if (ilBadge) {
                if (this.steps.length <= 1) {
                    ilBadge.className = 'p-3 rounded-lg text-sm text-center bg-atlas-card border border-atlas-border text-atlas-muted mb-3';
                    ilBadge.innerText = 'Sem swaps ainda — IL = 0';
                } else {
                    const ilPct = v.il * 100;
                    ilBadge.className = 'p-3 rounded-lg text-sm text-center mb-3 ' + (ilPct < -0.01 ? 'bg-red-900/20 border border-red-500/40 text-red-400' : 'bg-green-900/20 border border-green-500/30 text-green-400');
                    ilBadge.innerHTML = 'Impermanent loss: <strong class="lab-mono">' + ilPct.toFixed(2) + '%</strong> (' + fmtUSD(v.lpValue - v.hodl) + ')';
                }
            }
        },
        renderChart() {
            if (defiCharts.pool) {
                defiCharts.pool.data.labels = this.steps.map((_, i) => String(i));
                defiCharts.pool.data.datasets[0].data = this.steps;
                defiCharts.pool.update();
            }
        }
    };

    /* ---------- M6 IL ---------- */
    const ilLab = {
        calc() {
            const p0 = parseFloat(document.getElementById('il-p0').value) || 1;
            const eth = parseFloat(document.getElementById('il-amt').value) || 1;
            const r = parseFloat(document.getElementById('il-ratio').value) || 1;
            const p1 = p0 * r;
            const il = 2 * Math.sqrt(r) / (1 + r) - 1;
            const hodl = eth * p1 + eth * p0;
            const lp = 2 * eth * p0 * Math.sqrt(r);
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            setTxt('il-ratio-label', r.toFixed(2) + '×');
            setTxt('il-hodl', fmtUSD(hodl));
            setTxt('il-lp', fmtUSD(lp));
            setTxt('il-pct', (il * 100).toFixed(2) + '%');
            const stepsEl = document.getElementById('il-steps');
            if (stepsEl) {
                stepsEl.innerHTML =
                    '<span class="text-blue-400">PASSO A PASSO</span><br>' +
                    '1. Depósito: ' + eth + ' ETH + ' + fmtUSD(eth * p0) + '<br>' +
                    '2. Preço: ' + fmtUSD(p0) + ' → ' + fmtUSD(p1) + '<br>' +
                    '3. HODL = <span class="text-blue-400">' + fmtUSD(hodl) + '</span><br>' +
                    '4. LP = 2·√(k·P₁) = <span class="text-purple-400">' + fmtUSD(lp) + '</span><br>' +
                    '5. IL = <span class="text-red-400">' + (il * 100).toFixed(2) + '%</span>';
            }
            if (defiCharts.il) {
                const ds = defiCharts.il.data.datasets[0];
                ds.pointRadius = defiCharts.ilLabels.map(v => Math.abs(v - r) < 0.06 ? 6 : 0);
                defiCharts.il.update();
            }
        }
    };

    /* ---------- M6 Lending ---------- */
    const lendLab = {
        LIQ_TH: 0.80,
        calc() {
            const basePrice = parseFloat(document.getElementById('ll-price').value) || 2000;
            const drop = parseFloat(document.getElementById('ll-drop').value) || 0;
            const col = parseFloat(document.getElementById('ll-col').value) || 1;
            const debt = parseFloat(document.getElementById('ll-debt').value) || 0;
            const price = basePrice * (1 + drop / 100);
            const colVal = col * price;
            const ltv = debt > 0 ? debt / colVal : 0;
            const hf = debt > 0 ? (colVal * this.LIQ_TH) / debt : Infinity;
            const liqPrice = debt > 0 ? debt / (col * this.LIQ_TH) : 0;
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            setTxt('ll-drop-label', (drop >= 0 ? '+' : '') + drop + '%');
            setTxt('ll-cur-price', fmtUSD(price));
            setTxt('ll-col-val', fmtUSD(colVal));
            setTxt('ll-ltv', (ltv * 100).toFixed(1) + '%');
            setTxt('ll-liq-price', liqPrice > 0 ? fmtUSD(liqPrice) : '—');
            setTxt('ll-hf', 'HF ' + (hf === Infinity ? '∞' : hf.toFixed(2)));
            const marker = document.getElementById('ll-marker');
            if (marker) marker.style.left = Math.min(Math.max(ltv * 100, 0), 99) + '%';
            const status = document.getElementById('ll-status');
            const liqPanel = document.getElementById('ll-liquidated');
            if (status && liqPanel) {
                if (hf === Infinity) {
                    status.className = 'p-3 rounded-lg text-sm text-center bg-atlas-card border border-atlas-border text-atlas-muted';
                    status.innerText = 'Sem dívida';
                    liqPanel.classList.add('hidden');
                } else if (hf >= 1.5) {
                    status.className = 'p-3 rounded-lg text-sm text-center bg-green-900/20 border border-green-500/30 text-green-400';
                    status.innerText = '🟢 Posição saudável';
                    liqPanel.classList.add('hidden');
                } else if (hf >= 1) {
                    status.className = 'p-3 rounded-lg text-sm text-center bg-orange-900/20 border border-orange-500/40 text-orange-400';
                    status.innerText = '🟠 RISCO: reforce o colateral';
                    liqPanel.classList.add('hidden');
                } else {
                    status.className = 'p-3 rounded-lg text-sm text-center bg-red-900/20 border border-red-500/40 text-red-400';
                    status.innerText = '🔴 Elegível para liquidação';
                    liqPanel.classList.remove('hidden');
                    liqPanel.innerHTML = '⚡ Uma posição com HF abaixo de 1 pode ser liquidada. Bônus, parcela liquidável e regras dependem do mercado; este simulador não executa liquidações.';
                }
            }
        }
    };

    /* ---------- M6 APR ---------- */
    const aprLab = {
        apyFor(apr, n) { return n > 100000 ? Math.exp(apr) - 1 : Math.pow(1 + apr / n, n) - 1; },
        calc() {
            const aprPct = parseFloat(document.getElementById('ap-apr').value) || 0;
            const apr = aprPct / 100;
            const n = parseInt(document.getElementById('ap-n').value, 10);
            const principal = parseFloat(document.getElementById('ap-principal').value) || 0;
            const years = parseFloat(document.getElementById('ap-years').value) || 1;
            const apy = this.apyFor(apr, n);
            const finalCompound = principal * Math.pow(1 + apy, years);
            const finalSimple = principal * (1 + apr * years);
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            setTxt('ap-apy', (apy * 100).toFixed(2) + '%');
            setTxt('ap-formula', 'APY = (1 + ' + aprPct + '% ÷ ' + n.toLocaleString('pt-BR') + ')^' + n.toLocaleString('pt-BR') + ' − 1');
            setTxt('ap-compound', fmtUSD(finalCompound));
            setTxt('ap-simple', fmtUSD(finalSimple));
            const gain = document.getElementById('ap-gain');
            if (gain) gain.innerHTML = '✨ A composição adicionou <strong>' + fmtUSD(finalCompound - finalSimple) + '</strong>.';
            const freqs = [{ label: 'Anual', n: 1 }, { label: 'Mensal', n: 12 }, { label: 'Diária', n: 365 }, { label: 'Por bloco (~12s)', n: 2628000 }];
            const tbody = document.getElementById('ap-table');
            if (tbody) {
                tbody.innerHTML = freqs.map(f => `<tr class="border-t border-atlas-border ${f.n === n ? 'text-blue-400 font-bold' : ''}"><td class="p-2">${f.label}</td><td class="p-2 text-right">${(this.apyFor(apr, f.n) * 100).toFixed(2)}%</td></tr>`).join('');
            }
        }
    };

    /* ---------- M6 Charts ---------- */
    const defiCharts = {
        ready: false, pool: null, il: null, ilLabels: [],
        ensure() {
            if (this.ready) return;
            this.ready = true;
            const pc = document.getElementById('poolChart');
            if (pc) {
                this.pool = new Chart(pc, {
                    type: 'line',
                    data: { labels: poolLab.steps.map((_, i) => String(i)), datasets: [{ label: 'Preço do pool (USDC/ETH)', data: poolLab.steps, borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)', fill: true, tension: 0.25 }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12 } } }, scales: { y: { grid: { color: '#2a3b55' }, ticks: { color: '#94a3b8' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8' } } } }
                });
            }
            const ic = document.getElementById('ilChart');
            if (ic) {
                this.ilLabels = [];
                const data = [];
                for (let i = 1; i <= 50; i++) {
                    const r = i / 10;
                    this.ilLabels.push(r);
                    data.push((2 * Math.sqrt(r) / (1 + r) - 1) * 100);
                }
                this.il = new Chart(ic, {
                    type: 'line',
                    data: { labels: this.ilLabels.map(v => v.toFixed(1) + '×'), datasets: [{ label: 'IL (%)', data, borderColor: '#a855f7', backgroundColor: 'rgba(168,85,247,0.12)', fill: true, tension: 0.3, pointRadius: 0, pointBackgroundColor: '#a855f7' }] },
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: '#2a3b55' }, ticks: { color: '#94a3b8', callback: v => v + '%' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 10 } } } }
                });
            }
        }
    };

    /* ---------- M7 Vault ---------- */
    const vaultLab = {
        MIN_RATIO: 1.5,
        calc() {
            const basePrice = parseFloat(document.getElementById('vl-price').value) || 3000;
            const eth = parseFloat(document.getElementById('vl-eth').value) || 1;
            const drop = parseFloat(document.getElementById('vl-drop').value) || 0;
            const price = basePrice * (1 + drop / 100);
            const colVal = eth * price;
            const maxMint = (eth * basePrice) / this.MIN_RATIO;
            const debtSlider = document.getElementById('vl-debt');
            if (debtSlider) debtSlider.max = Math.max(100, Math.floor(maxMint / 50) * 50);
            const debt = Math.min(parseFloat(debtSlider ? debtSlider.value : 0) || 0, maxMint);
            const ratio = debt > 0 ? colVal / debt : Infinity;
            const liqPrice = debt > 0 ? (debt * this.MIN_RATIO) / eth : 0;
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            setTxt('vl-drop-label', (drop >= 0 ? '+' : '') + drop + '%');
            setTxt('vl-max', fmtUSD(maxMint));
            setTxt('vl-cur-price', fmtUSD(price));
            setTxt('vl-colval', fmtUSD(colVal));
            setTxt('vl-ratio', ratio === Infinity ? '∞' : (ratio * 100).toFixed(0) + '%');
            setTxt('vl-liq', liqPrice > 0 ? fmtUSD(liqPrice) : '—');
            setTxt('vl-hf', debt > 0 ? 'ratio ' + (ratio * 100).toFixed(0) + '% · dívida ' + fmtUSD(debt) : 'sem dívida');
            const marker = document.getElementById('vl-marker');
            if (marker) marker.style.left = (Math.min(Math.max((ratio - 1) / 2, 0), 1) * 100) + '%';
            const status = document.getElementById('vl-status');
            const liqPanel = document.getElementById('vl-liquidated');
            const marginEl = document.getElementById('vl-margin');
            if (status && liqPanel) {
                if (debt <= 0) {
                    status.className = 'p-3 rounded-lg text-sm text-center bg-atlas-card border border-atlas-border text-atlas-muted';
                    status.innerText = 'Sem dívida mintada';
                    liqPanel.classList.add('hidden');
                    if (marginEl) marginEl.innerText = '';
                } else if (ratio < this.MIN_RATIO) {
                    status.className = 'p-3 rounded-lg text-sm text-center bg-red-900/20 border border-red-500/40 text-red-400';
                    status.innerText = '🔴 Vault elegível para liquidação';
                    liqPanel.classList.remove('hidden');
                    liqPanel.innerHTML = 'Neste cenário, o limiar foi ultrapassado. Elegibilidade não significa execução automática. Penalidade, leilão e regras variam por protocolo; dívida: ' + fmtUSD(debt) + '.';
                    if (marginEl) marginEl.innerText = '';
                } else {
                    status.className = 'p-3 rounded-lg text-sm text-center ' + (ratio < 1.8 ? 'bg-orange-900/20 border border-orange-500/40 text-orange-400' : 'bg-green-900/20 border border-green-500/30 text-green-400');
                    status.innerText = ratio < 1.8 ? '🟠 Zona de risco' : '🟢 Vault saudável';
                    liqPanel.classList.add('hidden');
                    if (marginEl) marginEl.innerText = '🛡 O ETH pode cair ' + ((1 - liqPrice / price) * 100).toFixed(1) + '% (até ' + fmtUSD(liqPrice) + ') antes da liquidação.';
                }
            }
        }
    };

    /* ---------- M7 Depeg ---------- */
    const depegLab = {
        last: null,
        preview() {
            const b = document.getElementById('dp-backing');
            const p = document.getElementById('dp-panic');
            const bl = document.getElementById('dp-backing-label');
            const pl = document.getElementById('dp-panic-label');
            if (bl && b) bl.innerText = b.value + '%';
            if (pl && p) pl.innerText = p.value + '%';
        },
        preset(b, p) {
            const be = document.getElementById('dp-backing');
            const pe = document.getElementById('dp-panic');
            if (be) be.value = b;
            if (pe) pe.value = p;
            this.preview();
            this.run();
        },
        run() {
            const backing0 = (parseFloat(document.getElementById('dp-backing').value) || 0) / 100;
            const panic = Number(document.getElementById('dp-panic').value) / 100;
            let price = 1, backing = backing0;
            const prices = [1], backings = [backing0 * 100];
            for (let round = 0; round < 20; round++) {
                const deviation = Math.max(0, 1 - price);
                const pressure = panic * (0.12 + deviation);
                backing = Math.max(0, backing - pressure * 0.10);
                let recovery = 0;
                if (backing >= 0.95) recovery = (1 - price) * 0.65;
                else if (backing >= 0.6) recovery = (1 - price) * 0.15;
                price = Math.max(0.001, Math.min(1.02, price - pressure * 0.14 + recovery));
                prices.push(price);
                backings.push(backing * 100);
                if (price < 0.03) break;
            }
            this.last = { prices, backings };
            const finalPrice = prices[prices.length - 1];
            const maxDev = Math.max(...prices.map(p => 1 - p)) * 100;
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            setTxt('dp-final-price', 'US$ ' + finalPrice.toFixed(3));
            setTxt('dp-max-dev', '−' + maxDev.toFixed(1) + '%');
            setTxt('dp-final-backing', backing.toFixed(1) + '%');
            const verdict = document.getElementById('dp-verdict');
            if (verdict) {
                if (finalPrice < 0.2) {
                    verdict.className = 'p-3 rounded-lg text-sm text-center bg-red-900/20 border border-red-500/40 text-red-400';
                    verdict.innerHTML = '<strong>Queda acentuada no modelo.</strong> Resultado ilustrativo; não reproduz um evento histórico nem prevê irreversibilidade.';
                } else if (finalPrice < 0.95) {
                    verdict.className = 'p-3 rounded-lg text-sm text-center bg-yellow-900/20 border border-yellow-500/30 text-yellow-400';
                    verdict.innerHTML = '⚠️ <strong>Depeg severo</strong> — exigiria intervenção.';
                } else {
                    verdict.className = 'p-3 rounded-lg text-sm text-center bg-green-900/20 border border-green-500/30 text-green-400';
                    verdict.innerHTML = '<strong>Desvio limitado neste modelo.</strong> Não reproduz um evento histórico e não garante estabilidade futura.';
                }
            }
            this.redraw();
        },
        reset() {
            this.last = null;
            ['dp-final-price', 'dp-max-dev', 'dp-final-backing'].forEach(id => { const el = document.getElementById(id); if (el) el.innerText = '—'; });
            const verdict = document.getElementById('dp-verdict');
            if (verdict) {
                verdict.className = 'p-3 rounded-lg text-sm text-center bg-atlas-card border border-atlas-border text-atlas-muted';
                verdict.innerText = 'Configure e execute.';
            }
            this.preview();
            this.redraw();
        },
        redraw() {
            if (!stableCharts.depeg) return;
            const d = this.last || { prices: [1], backings: [100] };
            stableCharts.depeg.data.labels = d.prices.map((_, i) => String(i));
            stableCharts.depeg.data.datasets[0].data = d.prices;
            stableCharts.depeg.data.datasets[1].data = d.backings;
            stableCharts.depeg.update();
        }
    };

    /* ---------- M7 Comparador ---------- */
    const stableCmp = {
        filter: 'all',
        data: [
            {cat:'fiat',name:'Reservas em ativos',backing:'Caixa e instrumentos financeiros conforme o desenho',mechanism:'Emissão e resgate segundo regras do emissor',risks:'Qualidade e liquidez de reservas; custódia; direito de resgate'},
            {cat:'crypto',name:'Garantias cripto',backing:'Ativos comprometidos sob regras de colateralização',mechanism:'Emissão contra garantia e controles de solvência',risks:'Volatilidade, oráculo, liquidação e contrato'},
            {cat:'algo',name:'Mecanismos algorítmicos',backing:'Varia por desenho; incentivos não equivalem a reservas líquidas',mechanism:'Ajustes e incentivos para tentar sustentar a paridade',risks:'Falha de incentivos, confiança e capacidade de absorver vendas'}
        ],
        setFilter(f) {this.filter=f;document.querySelectorAll('.cmp-btn').forEach(b=>b.classList.toggle('active',b.dataset.f===f));this.render();},
        render() {const grid=document.getElementById('cmp-grid');if(!grid)return;grid.innerHTML=this.data.filter(d=>this.filter==='all'||d.cat===this.filter).map(d=>`<article class="panel"><h3>${d.name}</h3><p class="muted">${d.backing}</p><p><strong>Mecanismo:</strong> ${d.mechanism}</p><p><strong>Dependências:</strong> ${d.risks}</p><p class="source-inline"><a href="${SOURCES.stable[1]}" target="_blank" rel="noopener noreferrer">Ethereum · Stablecoins ↗</a></p><small>Categorias conceituais, sem cotação, nota de risco ou paridade atual.</small></article>`).join('');}
    };

    const stableCharts = {
        ready: false, depeg: null,
        ensure() {
            if (this.ready) return;
            this.ready = true;
            const cv = document.getElementById('depegChart');
            if (cv) {
                this.depeg = new Chart(cv, {
                    type: 'line',
                    data: { labels: ['0'], datasets: [
                        { label: 'Preço (US$)', data: [1], borderColor: '#22d3ee', backgroundColor: 'rgba(34,211,238,0.1)', fill: true, tension: 0.3, pointRadius: 2 },
                        { label: 'Lastro (%)', data: [100], borderColor: '#f97316', borderDash: [5, 4], tension: 0.3, pointRadius: 0, yAxisID: 'y1' }
                    ]},
                    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12 } } }, scales: { y: { min: 0, max: 1.1, grid: { color: '#2a3b55' }, ticks: { color: '#22d3ee' } }, y1: { position: 'right', min: 0, max: 100, grid: { display: false }, ticks: { color: '#f97316', callback: v => v + '%' } }, x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 12 } } } }
                });
            }
        }
    };

    /* ---------- M8 RWA ---------- */
    const rwaLab = {
        value: 0, totalTokens: 0, pricePerToken: 0, available: 0, rent: 0,
        names: ['Alice', 'Bruno', 'Carla', 'Diego'],
        colors: { Alice: '#3b82f6', Bruno: '#a855f7', Carla: '#22c55e', Diego: '#f59e0b' },
        holdings: {}, income: {},
        init() {
            this.holdings = {}; this.income = {};
            this.names.forEach(n => { this.holdings[n] = 0; this.income[n] = 0; });
            this.value = 0; this.totalTokens = 0; this.pricePerToken = 0; this.available = 0;
            const log = document.getElementById('rwa-log');
            if (log) log.innerHTML = '> aguardando tokenização…';
            this.render();
        },
        log(msg) {
            const el = document.getElementById('rwa-log');
            if (!el) return;
            el.innerHTML += '<br>> ' + msg;
            el.scrollTop = el.scrollHeight;
        },
        tokenizer() {
            const v = parseFloat(document.getElementById('rwa-value').value) || 0;
            const t = parseInt(document.getElementById('rwa-tokens').value, 10) || 0;
            if (v <= 0 || t <= 0) { alert('Informe valor do imóvel e quantidade de tokens válidos.'); return; }
            this.value = v; this.totalTokens = t;
            this.pricePerToken = v / t;
            this.available = t;
            this.rent = parseFloat(document.getElementById('rwa-rent').value) || 0;
            this.names.forEach(n => { this.holdings[n] = 0; this.income[n] = 0; });
            this.log('🏠 imóvel avaliado em ' + fmtBRL(v));
            this.log('🪙 emissão de ' + t.toLocaleString('pt-BR') + ' tokens a ' + fmtBRL(this.pricePerToken) + ' cada');
            this.log('Hipótese didática: uma estrutura jurídica precisaria definir os direitos. Este simulador não constitui uma entidade nem transfere propriedade.');
            this.render();
        },
        qtyPreview() {
            const qty = parseInt(document.getElementById('rwa-qty').value, 10) || 0;
            const el = document.getElementById('rwa-qty-cost');
            if (el) el.innerText = 'custo ' + fmtBRL(qty * this.pricePerToken);
        },
        buy() {
            if (!this.totalTokens) { alert('Tokenize o imóvel primeiro.'); return; }
            const name = document.getElementById('rwa-investor').value;
            const qty = parseInt(document.getElementById('rwa-qty').value, 10) || 0;
            if (qty <= 0) { alert('Quantidade inválida.'); return; }
            if (qty > this.available) { alert('Tokens insuficientes: restam ' + this.available.toLocaleString('pt-BR') + '.'); return; }
            this.holdings[name] += qty;
            this.available -= qty;
            this.log('🟢 ' + name + ' comprou ' + qty.toLocaleString('pt-BR') + ' tokens · participação ' + (this.holdings[name] / this.totalTokens * 100).toFixed(1) + '%');
            this.render();
        },
        sell() {
            if (!this.totalTokens) { alert('Tokenize o imóvel primeiro.'); return; }
            const name = document.getElementById('rwa-investor').value;
            const qty = parseInt(document.getElementById('rwa-qty').value, 10) || 0;
            if (qty <= 0) { alert('Quantidade inválida.'); return; }
            if (qty > this.holdings[name]) { alert(name + ' possui apenas ' + this.holdings[name].toLocaleString('pt-BR') + ' tokens.'); return; }
            this.holdings[name] -= qty;
            this.available += qty;
            this.log('🔴 ' + name + ' vendeu ' + qty.toLocaleString('pt-BR') + ' tokens');
            this.render();
        },
        distribute() {
            if (!this.totalTokens) { alert('Tokenize o imóvel primeiro.'); return; }
            const rent = parseFloat(document.getElementById('rwa-rent').value) || 0;
            if (rent <= 0) { alert('Informe um aluguel mensal.'); return; }
            const sold = this.totalTokens - this.available;
            if (sold === 0) { alert('Nenhum token distribuído ainda.'); return; }
            const perToken = rent / this.totalTokens;
            this.names.forEach(n => { this.income[n] += this.holdings[n] * perToken; });
            this.log('💸 aluguel de ' + fmtBRL(rent) + ' distribuído: ' + fmtBRL(perToken) + '/token');
            this.render();
        },
        render() {
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            setTxt('rwa-st-value', this.totalTokens ? fmtBRL(this.value) : '—');
            setTxt('rwa-st-tokens', this.totalTokens ? this.totalTokens.toLocaleString('pt-BR') : '—');
            setTxt('rwa-st-price', this.totalTokens ? fmtBRL(this.pricePerToken) : '—');
            setTxt('rwa-rent-per-token', this.totalTokens ? fmtBRL((parseFloat(document.getElementById('rwa-rent').value) || 0) / this.totalTokens) : '—');
            const sold = this.totalTokens - this.available;
            const pct = this.totalTokens ? (sold / this.totalTokens) * 100 : 0;
            setTxt('rwa-dist-pct', pct.toFixed(1) + '%');
            const bar = document.getElementById('rwa-dist-bar');
            if (bar) bar.style.width = pct + '%';
            this.qtyPreview();
            const wrap = document.getElementById('rwa-investors');
            if (!wrap) return;
            if (!this.totalTokens) {
                wrap.innerHTML = '<div class="text-xs text-atlas-muted italic">Tokenize o imóvel para começar.</div>';
                return;
            }
            wrap.innerHTML = this.names.map(n => {
                const h = this.holdings[n];
                const invested = h * this.pricePerToken;
                const share = (h / this.totalTokens) * 100;
                const color = this.colors[n];
                return `<div class="p-3 bg-atlas-card border border-atlas-border rounded-lg">
                    <div class="flex items-center justify-between mb-1">
                        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full" style="background:${color}"></span><span class="text-white text-sm font-semibold">${n}</span></div>
                        <span class="text-xs lab-mono" style="color:${color}">${share.toFixed(1)}%</span>
                    </div>
                    <div class="w-full bg-atlas-bg h-1.5 rounded-full overflow-hidden mb-2"><div class="h-full rounded-full" style="width:${share}%; background:${color}"></div></div>
                    <div class="grid grid-cols-3 gap-2 text-center text-[10px]">
                        <div><div class="text-atlas-muted">TOKENS</div><div class="text-white lab-mono font-bold">${h.toLocaleString('pt-BR')}</div></div>
                        <div><div class="text-atlas-muted">INVESTIDO</div><div class="text-white lab-mono font-bold">${fmtBRL(invested)}</div></div>
                        <div><div class="text-atlas-muted">ALUGUEL</div><div class="text-cyan-400 lab-mono font-bold">${fmtBRL(this.income[n])}</div></div>
                    </div>
                </div>`;
            }).join('') + `
                <div class="p-3 bg-atlas-bg/60 border border-atlas-border rounded-lg flex justify-between text-[11px]">
                    <span class="text-atlas-muted">Disponíveis: <strong class="text-amber-400 lab-mono">${this.available.toLocaleString('pt-BR')}</strong></span>
                    <span class="text-atlas-muted">Captado: <strong class="text-green-400 lab-mono">${fmtBRL(sold * this.pricePerToken)}</strong></span>
                </div>`;
        }
    };

    /* ---------- M9 Portfólio ---------- */
    function mulberry32(seed) {
        return function() {
            seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }
    function normalFrom(rng) {
        let u = 0, v = 0;
        while (u === 0) u = rng();
        while (v === 0) v = rng();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }
    const portLab = {
        assets: [
            { id: 'rf',   name: 'Renda Fixa',      ret: 0.11, vol: 0.03, color: '#38bdf8' },
            { id: 'fii',  name: 'FIIs / Imóveis',  ret: 0.11, vol: 0.18, color: '#34d399' },
            { id: 'br',   name: 'Ações Brasil',    ret: 0.13, vol: 0.22, color: '#fbbf24' },
            { id: 'us',   name: 'Ações EUA',       ret: 0.10, vol: 0.16, color: '#60a5fa' },
            { id: 'ouro', name: 'Ouro',            ret: 0.07, vol: 0.15, color: '#f59e0b' },
            { id: 'rwa',  name: 'RWA',             ret: 0.12, vol: 0.10, color: '#a78bfa' },
            { id: 'btc',  name: 'Bitcoin',         ret: 0.25, vol: 0.65, color: '#f97316' },
            { id: 'defi', name: 'DeFi / Altcoins', ret: 0.20, vol: 0.90, color: '#ef4444' }
        ],
        corr: [
            [1.0, 0.3, 0.2, 0.1, 0.0, 0.4, 0.1, 0.1],
            [0.3, 1.0, 0.6, 0.4, 0.1, 0.4, 0.2, 0.2],
            [0.2, 0.6, 1.0, 0.7, 0.1, 0.3, 0.3, 0.3],
            [0.1, 0.4, 0.7, 1.0, 0.0, 0.3, 0.4, 0.4],
            [0.0, 0.1, 0.1, 0.0, 1.0, 0.1, 0.1, 0.1],
            [0.4, 0.4, 0.3, 0.3, 0.1, 1.0, 0.2, 0.2],
            [0.1, 0.2, 0.3, 0.4, 0.1, 0.2, 1.0, 0.8],
            [0.1, 0.2, 0.3, 0.4, 0.1, 0.2, 0.8, 1.0]
        ],
        suggested: [30, 10, 10, 15, 5, 10, 15, 5],
        paths: 120, months: 300,
        donut: null, chart: null,
        init() {
            const wrap = document.getElementById('pt-sliders');
            if (wrap) {
                wrap.innerHTML = this.assets.map((a, i) => `
                    <div>
                        <div class="flex justify-between items-center text-[11px] mb-1">
                            <span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full" style="background:${a.color}"></span><span class="text-white font-medium">${a.name}</span><span class="text-atlas-muted">μ ${(a.ret * 100).toFixed(0)}% · σ ${(a.vol * 100).toFixed(0)}%</span></span>
                            <span id="pt-w-${i}" class="lab-mono text-atlas-muted">0%</span>
                        </div>
                        <input type="range" id="pt-s-${i}" min="0" max="100" step="1" value="${this.suggested[i]}" class="w-full" style="accent-color:${a.color}" oninput="portLab.update()">
                    </div>`).join('');
            }
            this.ensureCharts();
            this.renderCorr();
            this.update();
        },
        resetAlloc() {
            this.assets.forEach((a, i) => {
                const s = document.getElementById('pt-s-' + i);
                if (s) s.value = this.suggested[i];
            });
            this.update();
        },
        weights() {
            const raw = this.assets.map((a, i) => parseFloat((document.getElementById('pt-s-' + i) || {}).value) || 0);
            const sum = raw.reduce((s, v) => s + v, 0);
            return { raw, sum, w: sum > 0 ? raw.map(v => v / sum) : raw.map(() => 0) };
        },
        update() {
            const capital = parseFloat(document.getElementById('pt-capital').value) || 100000;
            const { sum, w } = this.weights();
            this.assets.forEach((a, i) => {
                const el = document.getElementById('pt-w-' + i);
                if (el) el.innerText = sum > 0 ? (w[i] * 100).toFixed(1) + '%' : '0%';
            });
            const ret = this.assets.reduce((s, a, i) => s + w[i] * a.ret, 0);
            let varSum = 0;
            for (let i = 0; i < this.assets.length; i++) {
                for (let j = 0; j < this.assets.length; j++) {
                    varSum += w[i] * w[j] * this.assets[i].vol * this.assets[j].vol * this.corr[i][j];
                }
            }
            const vol = Math.sqrt(Math.max(varSum, 0));
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            setTxt('pt-ret', sum > 0 ? (ret * 100).toFixed(1) + '%' : '—');
            setTxt('pt-vol', sum > 0 ? (vol * 100).toFixed(1) + '%' : '—');
            setTxt('pt-premium', sum > 0 ? ((ret - 0.10) * 100).toFixed(1) + ' p.p.' : '—');
            const badge = document.getElementById('pt-risk-badge');
            if (badge) {
                if (sum <= 0) { badge.innerText = 'SEM ALOCAÇÃO'; badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-atlas-card border border-atlas-border text-atlas-muted'; }
                else if (vol < 0.08) { badge.innerText = '🛡 CONSERVADOR'; badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 border border-green-500/30 text-green-400'; }
                else if (vol < 0.15) { badge.innerText = '⚖️ MODERADO'; badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 border border-blue-500/30 text-blue-400'; }
                else if (vol < 0.25) { badge.innerText = '🔥 ARROJADO'; badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-orange-500/10 border border-orange-500/30 text-orange-400'; }
                else { badge.innerText = '🌋 MUITO AGRESSIVO'; badge.className = 'px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 border border-red-500/30 text-red-400'; }
            }
            if (this.donut) {
                this.donut.data.datasets[0].data = this.assets.map((a, i) => +(w[i] * 100).toFixed(1));
                this.donut.update();
            }
            if (sum <= 0) return;
            const seed = Math.abs(Math.round(w.reduce((s, v, i) => s + v * (i + 1) * 9973, 0) * 1000)) + Math.round(capital) % 1000;
            const rng = mulberry32(seed || 42);
            const muM = ret / 12;
            const sgM = vol / Math.sqrt(12);
            const finals = [];
            const dds = [];
            const monthly = Array.from({ length: this.months + 1 }, () => []);
            for (let p = 0; p < this.paths; p++) {
                let value = capital, peak = capital, maxdd = 0;
                monthly[0].push(value);
                for (let m = 1; m <= this.months; m++) {
                    value = value * Math.exp((muM - 0.5 * sgM * sgM) + sgM * normalFrom(rng));
                    if (value > peak) peak = value;
                    const dd = (value - peak) / peak;
                    if (dd < maxdd) maxdd = dd;
                    monthly[m].push(value);
                }
                finals.push(value);
                dds.push(maxdd);
            }
            const percentile = (arr, q) => {
                const sorted = arr.slice().sort((a, b) => a - b);
                const idx = Math.min(sorted.length - 1, Math.floor(q * sorted.length));
                return sorted[idx];
            };
            const p10 = [], p50 = [], p90 = [];
            for (let m = 0; m <= this.months; m++) {
                p10.push(percentile(monthly[m], 0.10));
                p50.push(percentile(monthly[m], 0.50));
                p90.push(percentile(monthly[m], 0.90));
            }
            const labels = Array.from({ length: this.months + 1 }, (_, m) => String(m));
            if (this.chart) {
                this.chart.data.labels = labels;
                this.chart.data.datasets[0].data = p90;
                this.chart.data.datasets[1].data = p50;
                this.chart.data.datasets[2].data = p10;
                this.chart.update();
            }
            setTxt('pt-final-med', fmtBRLc(percentile(finals, 0.5)));
            setTxt('pt-dd', (percentile(dds, 0.5) * 100).toFixed(1) + '%');
            setTxt('pt-dd-worst', (Math.min(...dds) * 100).toFixed(1) + '%');
        },
        ensureCharts() {
            const dc = document.getElementById('ptDonut');
            if (dc && !this.donut) {
                this.donut = new Chart(dc, {
                    type: 'doughnut',
                    data: {
                        labels: this.assets.map(a => a.name),
                        datasets: [{ data: this.suggested, backgroundColor: this.assets.map(a => a.color), borderColor: '#151e32', borderWidth: 2 }]
                    },
                    options: { responsive: true, maintainAspectRatio: false, cutout: '58%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.label + ': ' + c.parsed + '%' } } } }
                });
            }
            const cc = document.getElementById('ptChart');
            if (cc && !this.chart) {
                this.chart = new Chart(cc, {
                    type: 'line',
                    data: { labels: [], datasets: [
                        { label: 'Melhor decil (P90)', data: [], borderColor: 'rgba(34,197,94,0.7)', borderWidth: 1.2, pointRadius: 0, tension: 0.2 },
                        { label: 'Mediana (P50)', data: [], borderColor: '#60a5fa', borderWidth: 2, pointRadius: 0, tension: 0.2 },
                        { label: 'Pior decil (P10)', data: [], borderColor: 'rgba(239,68,68,0.7)', borderWidth: 1.2, pointRadius: 0, tension: 0.2 }
                    ]},
                    options: {
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { labels: { color: '#94a3b8', boxWidth: 12, font: { size: 10 } } }, tooltip: { mode: 'index', intersect: false, callbacks: { title: items => 'Ano ' + (items[0].parsed.x / 12).toFixed(1), label: c => c.dataset.label + ': ' + fmtBRLc(c.parsed.y) } } },
                        scales: {
                            y: { grid: { color: '#2a3b55' }, ticks: { color: '#94a3b8', callback: v => fmtBRLc(v) } },
                            x: { grid: { display: false }, ticks: { color: '#94a3b8', maxTicksLimit: 9, callback: v => 'Ano ' + Math.round(v / 12) } }
                        }
                    }
                });
            }
        },
        renderCorr() {
            const wrap = document.getElementById('pt-corr');
            if (!wrap) return;
            const names = this.assets.map(a => a.name);
            let html = '<table class="lab-mono"><tr><td class="corr-cell bg-atlas-bg"></td>';
            names.forEach(n => { html += `<td class="corr-cell bg-atlas-bg text-atlas-muted" style="writing-mode:vertical-rl; transform:rotate(180deg); height:70px">${n.slice(0, 12)}</td>`; });
            html += '</tr>';
            for (let i = 0; i < names.length; i++) {
                html += `<tr><td class="corr-cell bg-atlas-bg text-atlas-muted" style="width:90px">${names[i].slice(0, 11)}</td>`;
                for (let j = 0; j < names.length; j++) {
                    const v = this.corr[i][j];
                    const bg = i === j ? 'rgba(59,130,246,0.85)' : `rgba(59,130,246,${(v * 0.75).toFixed(2)})`;
                    html += `<td class="corr-cell" style="background:${bg}; color:${v > 0.5 ? '#fff' : '#cbd5e1'}">${v.toFixed(1)}</td>`;
                }
                html += '</tr>';
            }
            html += '</table>';
            wrap.innerHTML = html;
        }
    };

    /* ---------- M10 · Corredor de Pagamentos ---------- */
    const sendLab = {
        calc() {
            const amt = parseFloat(document.getElementById('send-amt').value) || 0;
            if (amt <= 0) return;

            // Trilho tradicional: spread de câmbio ~3% + taxas fixas
            const oldFx = amt * 0.03;
            const oldFixed1 = 25;
            const oldFixed2 = 18;
            const oldFixed3 = 12;
            const oldCost = oldFx + oldFixed1 + oldFixed2 + oldFixed3;
            const oldNet = amt - oldCost;

            // Trilho stablecoin: spread de compra 0,5% + rede ~1,5 + off-ramp 0,8%
            const newBuy = amt * 0.005;
            const newNetwork = 1.5;
            const newOff = amt * 0.008;
            const newCost = newBuy + newNetwork + newOff;
            const newNet = amt - newCost;

            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.innerText = v; };
            setTxt('old-step1', 'US$ ' + (oldFx + oldFixed1).toLocaleString('pt-BR', { maximumFractionDigits: 0 }));
            setTxt('old-step2', 'US$ ' + oldFixed2);
            setTxt('old-step3', 'US$ ' + oldFixed3);
            setTxt('old-net', 'US$ ' + oldNet.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
            setTxt('new-step1', 'US$ ' + newBuy.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
            setTxt('new-step2', 'US$ ' + newNetwork.toFixed(2));
            setTxt('new-step3', 'US$ ' + newOff.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
            setTxt('new-net', 'US$ ' + newNet.toLocaleString('pt-BR', { maximumFractionDigits: 2 }));
            setTxt('send-old-cost', fmtUS(oldCost));
            setTxt('send-new-cost', fmtUS(newCost));

            const saved = oldCost - newCost;
            const savedEl = document.getElementById('send-saved');
            if (savedEl) {
                savedEl.innerText = fmtUS(saved) + ' (' + (saved / amt * 100).toFixed(1) + '%)';
                savedEl.className = 'text-sm font-bold lab-mono ' + (saved >= 0 ? 'text-green-400' : 'text-red-400');
            }
            const speedEl = document.getElementById('send-speed');
            if (speedEl) speedEl.innerText = '~' + Math.round((3.5 * 24 * 60) / 10) + '×';
        }
    };


// Assessments and application initialization are managed by academy.js.
