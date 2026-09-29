-- Preserva observações intradiárias sem alterar a leitura diária legada.
create table if not exists scanner.snapshots (
  pool_id text not null references scanner.pools(id) on delete cascade,
  observado_em timestamptz not null,
  tvl double precision not null,
  vol_24h double precision not null,
  vol_7d double precision,
  apr double precision,
  fee double precision not null,
  primary key (pool_id, observado_em)
);
create index if not exists scanner_snapshots_em_idx on scanner.snapshots (observado_em);
alter table scanner.snapshots enable row level security;

create or replace view public.scanner_snapshots as
select s.pool_id, s.observado_em, s.tvl, s.vol_24h, s.vol_7d, s.apr, s.fee
from scanner.snapshots s
join scanner.pools p on p.id = s.pool_id
where p.ativa and p.trilho <> 'barrada';
grant select on public.scanner_snapshots to anon, authenticated;
