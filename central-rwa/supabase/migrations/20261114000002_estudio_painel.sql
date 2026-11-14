-- Laboratório de Agentes · dados do painel (Fase 4, etapa 4.1), 14/11/2026.
--
-- O painel (a cidade) lê tudo por UMA função, public.laboratorio_painel(),
-- chamada pelo site com a chave publicável E o token de login do Firebase
-- (Supabase → Authentication → Third-Party Auth → Firebase "cryptotrack-br").
-- O Supabase só deixa passar tokens assinados por esse projeto Firebase; a
-- função confere ainda que o token é de um dono cadastrado em
-- estudio.laboratorio_donos (o código de usuário do Firebase, colocado à mão
-- no SQL Editor, fora do repositório). Sem isso devolve null.
--
-- Só leitura. O token do Firebase não traz o claim "role", então a consulta
-- roda como anon: por isso o grant de execute é para anon. As tabelas do
-- estúdio continuam fechadas para anon e authenticated. Idempotente.

create table if not exists estudio.laboratorio_donos (
  uid       text primary key,          -- "sub" do token do Firebase (UID do usuário)
  nome      text,
  criado_em timestamptz not null default now()
);
alter table estudio.laboratorio_donos enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on estudio.laboratorio_donos from anon, authenticated';
  end if;
end $$;

-- Claims do token da requisição (o PostgREST põe em request.jwt.claims).
create or replace function estudio.claims_da_requisicao() returns jsonb
language sql stable
set search_path = ''
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
$$;

create or replace function estudio.dono_do_laboratorio() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select c->>'iss' = 'https://securetoken.google.com/cryptotrack-br'
     and c->>'aud' = 'cryptotrack-br'
     and coalesce((c->>'exp')::bigint, 0) > extract(epoch from now())
     and exists (select 1 from estudio.laboratorio_donos d where d.uid = c->>'sub')
  from (select estudio.claims_da_requisicao() as c) x
$$;

create or replace function public.laboratorio_painel() returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  ultima timestamptz;
  hoje date := (now() at time zone 'utc')::date;
begin
  if not estudio.dono_do_laboratorio() then
    return null;
  end if;
  select max(rodada) into ultima from estudio.achados;
  return jsonb_build_object(
    'gerado_em', now(),
    'agentes', coalesce((select jsonb_agg(to_jsonb(s) order by s.agente) from estudio.agentes_status s), '[]'::jsonb),
    'varredura', (select to_jsonb(v) from estudio.varredura_status v order by v.inicio desc limit 1),
    'rodada', ultima,
    'achados', coalesce((
      select jsonb_agg(jsonb_build_object(
        'agente', a.agente, 'pool_id', a.pool_id, 'rede', a.rede, 'dex', a.dex, 'par', a.par,
        'modelo', a.modelo, 'faixas', a.faixas, 'preco', a.preco, 'faixa_min', a.faixa_min, 'faixa_max', a.faixa_max,
        'media_usd', a.media_usd, 'p10_usd', a.p10_usd, 'p90_usd', a.p90_usd, 'ganho_vs_ref_usd', a.ganho_vs_ref_usd,
        'em_faixa_pct', a.em_faixa_pct, 'capital_usd', a.capital_usd, 'dias', a.dias,
        'tokens', a.metricas->'tokens') order by a.media_usd desc)
      from estudio.achados a where a.rodada = ultima), '[]'::jsonb),
    'relatorio', (select jsonb_build_object('data', r.data, 'ranking', r.ranking, 'disputas', r.disputas,
                                            'conflitos', r.conflitos, 'rodadas', r.rodadas)
                  from estudio.relatorios_diarios r where r.data = hoje),
    'salas', coalesce((
      select jsonb_agg(jsonb_build_object('rede', x.rede, 'dex', x.dex, 'pools', x.n) order by x.rede, x.n desc)
      from (select rede, coalesce(dex, '?') as dex, count(*) as n from estudio.pools_prontas group by 1, 2) x), '[]'::jsonb),
    'registro', coalesce((
      select jsonb_agg(jsonb_build_object('rodada', y.rodada, 'achados', y.n, 'por_agente', y.por) order by y.rodada desc)
      from (select rodada, count(*) as n, jsonb_object_agg(agente, k) as por
            from (select rodada, agente, count(*) as k from estudio.achados
                  where rodada > now() - interval '24 hours' group by 1, 2) z
            group by rodada) y), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.laboratorio_painel() from public;
revoke all on function estudio.dono_do_laboratorio() from public;
revoke all on function estudio.claims_da_requisicao() from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.laboratorio_painel() to anon, authenticated';
  end if;
end $$;
