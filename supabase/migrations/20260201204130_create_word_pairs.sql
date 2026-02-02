-- Create word_pairs table for user-defined word pairs
create table if not exists public.word_pairs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  word1 text not null,
  word2 text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add foreign key constraint if it doesn't exist
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'word_pairs_user_id_fkey'
  ) then
    alter table public.word_pairs 
    add constraint word_pairs_user_id_fkey 
    foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Enable Row Level Security
alter table public.word_pairs enable row level security;

-- Create policies for word_pairs table
-- Allow users to view their own word pairs
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'word_pairs' 
    and policyname = 'Users can view their own word pairs'
  ) then
    create policy "Users can view their own word pairs"
      on public.word_pairs
      for select
      using (auth.uid() = user_id);
  end if;
end $$;

-- Allow users to create their own word pairs
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'word_pairs' 
    and policyname = 'Users can create their own word pairs'
  ) then
    create policy "Users can create their own word pairs"
      on public.word_pairs
      for insert
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Allow users to update their own word pairs
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'word_pairs' 
    and policyname = 'Users can update their own word pairs'
  ) then
    create policy "Users can update their own word pairs"
      on public.word_pairs
      for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

-- Allow users to delete their own word pairs
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'word_pairs' 
    and policyname = 'Users can delete their own word pairs'
  ) then
    create policy "Users can delete their own word pairs"
      on public.word_pairs
      for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- Create function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
drop trigger if exists update_word_pairs_updated_at on public.word_pairs;
create trigger update_word_pairs_updated_at
  before update on public.word_pairs
  for each row
  execute procedure public.handle_updated_at();