-- Telegram integration
create table if not exists public.telegram_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  connected boolean not null default false,
  bot_id bigint,
  bot_username text,
  automation_enabled boolean not null default true,
  sleeping_mode boolean not null default false,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.telegram_settings to authenticated;
grant all on public.telegram_settings to service_role;
alter table public.telegram_settings enable row level security;
create policy "own telegram settings" on public.telegram_settings
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create type public.telegram_conv_state as enum ('BEACON_ACTIVE','HUMAN_TAKEOVER');

create table if not exists public.telegram_customers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  telegram_chat_id bigint not null,
  telegram_user_id bigint,
  telegram_username text,
  display_name text,
  status text not null default 'new',
  notes text,
  state public.telegram_conv_state not null default 'BEACON_ACTIVE',
  handoff_reason text,
  waiting_for_human boolean not null default false,
  handled_while_sleeping boolean not null default false,
  last_interaction timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, telegram_chat_id)
);
grant select, insert, update, delete on public.telegram_customers to authenticated;
grant all on public.telegram_customers to service_role;
alter table public.telegram_customers enable row level security;
create policy "own telegram customers" on public.telegram_customers
  for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.telegram_messages (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.telegram_customers(id) on delete cascade,
  update_id bigint,
  direction text not null check (direction in ('in','out')),
  sender text not null check (sender in ('customer','beacon','human')),
  text text,
  created_at timestamptz not null default now()
);
create unique index if not exists telegram_messages_update_unique
  on public.telegram_messages (owner_id, update_id) where update_id is not null;
create index if not exists telegram_messages_customer_idx
  on public.telegram_messages (customer_id, created_at);
grant select, insert, update, delete on public.telegram_messages to authenticated;
grant all on public.telegram_messages to service_role;
alter table public.telegram_messages enable row level security;
create policy "own telegram messages" on public.telegram_messages
  for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create table if not exists public.telegram_style_examples (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  customer_message text not null,
  owner_reply text not null,
  tag text,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.telegram_style_examples to authenticated;
grant all on public.telegram_style_examples to service_role;
alter table public.telegram_style_examples enable row level security;
create policy "own style examples" on public.telegram_style_examples
  for all to authenticated using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

create trigger telegram_settings_touch before update on public.telegram_settings
  for each row execute function public.update_updated_at_column();
create trigger telegram_customers_touch before update on public.telegram_customers
  for each row execute function public.update_updated_at_column();