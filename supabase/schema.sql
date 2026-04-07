-- supabase/schema.sql

-- profiles
create table if not exists profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  nickname text not null unique,
  created_at timestamptz default now() not null
);
alter table profiles enable row level security;
create policy "read profiles" on profiles for select to authenticated using (true);
create policy "insert own profile" on profiles for insert to authenticated with check (auth.uid() = id);
create policy "update own profile" on profiles for update to authenticated using (auth.uid() = id);

-- messages
create table if not exists messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references profiles(id) on delete cascade not null,
  content text,
  image_url text,
  created_at timestamptz default now() not null,
  constraint content_or_image check (content is not null or image_url is not null)
);
alter table messages enable row level security;
create policy "read messages" on messages for select to authenticated using (true);
create policy "insert own messages" on messages for insert to authenticated with check (auth.uid() = sender_id);

-- reactions
create table if not exists reactions (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references messages(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  emoji text not null,
  unique(message_id, user_id, emoji)
);
alter table reactions enable row level security;
create policy "read reactions" on reactions for select to authenticated using (true);
create policy "insert own reactions" on reactions for insert to authenticated with check (auth.uid() = user_id);
create policy "delete own reactions" on reactions for delete to authenticated using (auth.uid() = user_id);

-- message_reads
create table if not exists message_reads (
  message_id uuid references messages(id) on delete cascade not null,
  user_id uuid references profiles(id) on delete cascade not null,
  read_at timestamptz default now() not null,
  primary key (message_id, user_id)
);
alter table message_reads enable row level security;
create policy "read message_reads" on message_reads for select to authenticated using (true);
create policy "insert own reads" on message_reads for insert to authenticated with check (auth.uid() = user_id);

-- Realtime 활성화
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table reactions;
alter publication supabase_realtime add table message_reads;
