-- Add user_id column to words table for user-specific words
-- Seed words will have user_id = null, user words will have user_id = auth.uid()

-- Add user_id column (nullable for seed words)
alter table public.words 
add column if not exists user_id uuid;

-- Add foreign key constraint if it doesn't exist
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'words_user_id_fkey'
  ) then
    alter table public.words 
    add constraint words_user_id_fkey 
    foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

-- Create index on user_id for performance
create index if not exists words_user_id_idx on public.words(user_id);

-- Enable Row Level Security
alter table public.words enable row level security;

-- Create policies for words table
-- Allow users to view seed words (user_id IS NULL) and their own words
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'words' 
    and policyname = 'Users can view seed words and their own words'
  ) then
    create policy "Users can view seed words and their own words"
      on public.words
      for select
      using (user_id IS NULL OR user_id = auth.uid());
  end if;
end $$;

-- Allow users to create their own words
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'words' 
    and policyname = 'Users can create their own words'
  ) then
    create policy "Users can create their own words"
      on public.words
      for insert
      with check (user_id = auth.uid());
  end if;
end $$;

-- Allow users to update their own words
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'words' 
    and policyname = 'Users can update their own words'
  ) then
    create policy "Users can update their own words"
      on public.words
      for update
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end $$;

-- Allow users to delete their own words
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'words' 
    and policyname = 'Users can delete their own words'
  ) then
    create policy "Users can delete their own words"
      on public.words
      for delete
      using (user_id = auth.uid());
  end if;
end $$;
