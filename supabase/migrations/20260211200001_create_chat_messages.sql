-- Create chat_messages table for conversation messages
create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  metadata jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_messages_chat_id_fkey'
  ) then
    alter table public.chat_messages
    add constraint chat_messages_chat_id_fkey
    foreign key (chat_id) references public.chats(id) on delete cascade;
  end if;
end $$;

alter table public.chat_messages enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'chat_messages'
    and policyname = 'Users can view messages of their chats'
  ) then
    create policy "Users can view messages of their chats"
      on public.chat_messages
      for select
      using (
        exists (
          select 1 from public.chats
          where chats.id = chat_messages.chat_id
          and chats.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'chat_messages'
    and policyname = 'Users can insert messages into their chats'
  ) then
    create policy "Users can insert messages into their chats"
      on public.chat_messages
      for insert
      with check (
        exists (
          select 1 from public.chats
          where chats.id = chat_messages.chat_id
          and chats.user_id = auth.uid()
        )
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'chat_messages'
    and policyname = 'Users can delete messages of their chats'
  ) then
    create policy "Users can delete messages of their chats"
      on public.chat_messages
      for delete
      using (
        exists (
          select 1 from public.chats
          where chats.id = chat_messages.chat_id
          and chats.user_id = auth.uid()
        )
      );
  end if;
end $$;

create index if not exists idx_chat_messages_chat_id on public.chat_messages(chat_id);
create index if not exists idx_chat_messages_created_at on public.chat_messages(chat_id, created_at);
