create extension if not exists vector;

create table public.memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  category text not null default 'fact',
  source text,
  embedding vector(3072),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.memories to authenticated;
grant all on public.memories to service_role;

alter table public.memories enable row level security;

create policy "own memories" on public.memories
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index memories_user_created_idx on public.memories (user_id, created_at desc);
create index memories_embedding_idx on public.memories
  using hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops);

create trigger memories_updated_at
  before update on public.memories
  for each row execute function public.update_updated_at_column();

create or replace function public.match_memories(
  query_embedding vector(3072),
  match_count int default 6,
  target_user uuid default auth.uid()
)
returns table (
  id uuid,
  content text,
  category text,
  similarity float,
  created_at timestamptz
)
language sql stable
security definer
set search_path = public
as $$
  select
    m.id,
    m.content,
    m.category,
    1 - (m.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)) as similarity,
    m.created_at
  from public.memories m
  where m.user_id = target_user
    and m.embedding is not null
  order by m.embedding::halfvec(3072) <=> query_embedding::halfvec(3072)
  limit match_count;
$$;