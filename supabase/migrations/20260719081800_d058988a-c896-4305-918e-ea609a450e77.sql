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
security invoker
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