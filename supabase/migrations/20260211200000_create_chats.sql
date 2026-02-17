-- Create chats table for tutor conversation sessions
create table if not exists public.chats (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  title text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chats_user_id_fkey'
  ) then
    alter table public.chats
    add constraint chats_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.chats enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'chats'
    and policyname = 'Users can view their own chats'
  ) then
    create policy "Users can view their own chats"
      on public.chats
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'chats'
    and policyname = 'Users can create their own chats'
  ) then
    create policy "Users can create their own chats"
      on public.chats
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'chats'
    and policyname = 'Users can update their own chats'
  ) then
    create policy "Users can update their own chats"
      on public.chats
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'chats'
    and policyname = 'Users can delete their own chats'
  ) then
    create policy "Users can delete their own chats"
      on public.chats
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

drop trigger if exists update_chats_updated_at on public.chats;
create trigger update_chats_updated_at
  before update on public.chats
  for each row
  execute procedure public.handle_updated_at();
