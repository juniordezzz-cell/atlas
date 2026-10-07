-- Scanner Pools: a tela passa a receber o ENDEREÇO de cada token e o ID dele
-- na CoinGecko.
--
-- Pedido do dono (07/10/2026): o ✕ numa pool bloqueia o token pelo contrato
-- (o oficial, não uma cópia com o mesmo nome) e, se ele tiver ID na
-- CoinGecko, o mesmo token oficial em todas as redes. A view só trazia o
-- símbolo; o endereço estava em scanner.pools e o ID em scanner.tokens.
--
-- Colunas novas no FIM (create or replace view só aceita acrescentar). A
-- migração 20260923000001 recria a view sem elas a cada coleta e esta, que
-- roda depois (ordem do nome), devolve. Falha vira aviso: não pode derrubar
-- a coleta que a aplica.

do $$
begin
  execute $v$
    create or replace view public.scanner_pools as
    select p.id, p.rede, p.dex, p.par, p.simbolo_a, p.simbolo_b, p.fee, p.tvl, p.vol_24h, p.vol_7d, p.apr, p.apr_reward,
           p.criada_em, p.sinais, p.trilho, p.motivos, p.nota, p.componentes, p.visto_em,
           h.leituras,
           case when h.base_dia < h.ult_dia and h.base_tvl > 0 then h.ult_tvl / h.base_tvl - 1 end as var_tvl_7d,
           p.token_a, p.token_b, ta.coingecko_id as cg_a, tb.coingecko_id as cg_b
    from scanner.pools p
    left join lateral (
      select count(*) as leituras,
             max(l.dia) as ult_dia,
             (select l2.tvl from scanner.leituras l2 where l2.pool_id = p.id order by l2.dia desc limit 1) as ult_tvl,
             (select l3.dia from scanner.leituras l3 where l3.pool_id = p.id
                and l3.dia >= (select max(dia) from scanner.leituras where pool_id = p.id) - 7
              order by l3.dia asc limit 1) as base_dia,
             (select l4.tvl from scanner.leituras l4 where l4.pool_id = p.id
                and l4.dia >= (select max(dia) from scanner.leituras where pool_id = p.id) - 7
              order by l4.dia asc limit 1) as base_tvl
      from scanner.leituras l where l.pool_id = p.id
    ) h on true
    left join scanner.tokens ta on ta.rede = p.rede
      and ta.endereco = case when p.rede in ('Solana', 'Sui') then p.token_a else lower(p.token_a) end
    left join scanner.tokens tb on tb.rede = p.rede
      and tb.endereco = case when p.rede in ('Solana', 'Sui') then p.token_b else lower(p.token_b) end
    where p.ativa and p.trilho <> 'barrada'
  $v$;
  grant select on public.scanner_pools to anon, authenticated;
exception when others then
  raise warning 'Scanner Pools: view com endereços não criada (%). A tela segue bloqueando pelo nome.', sqlerrm;
end $$;
