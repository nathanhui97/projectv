-- Initial schema for Project V
-- Apply to Supabase dev project via: supabase db push

-- Profiles (extends Supabase Auth users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- Cards (the full card catalog; full CardSchema stored as jsonb)
create table if not exists cards (
  id text primary key,
  data jsonb not null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'errata', 'banned')),
  set_code text not null,
  version int not null default 1,
  previous_version_id text references cards(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cards_set_code_idx on cards(set_code);
create index if not exists cards_status_idx on cards(status);

-- Traits dictionary
create table if not exists traits (
  slug text primary key,
  display_name text not null,
  category text,
  description text,
  created_at timestamptz not null default now()
);

-- Decks (full DeckSchema stored as jsonb)
create table if not exists decks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  is_valid boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists decks_user_id_idx on decks(user_id);

-- Matches
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  room_code text unique not null,
  status text not null default 'waiting'
    check (status in ('waiting', 'in_progress', 'ended')),
  player_a_id uuid references auth.users(id),
  player_b_id uuid references auth.users(id),
  player_a_deck_id uuid references decks(id),
  player_b_deck_id uuid references decks(id),
  winner_index int check (winner_index in (0, 1)),
  rng_seed bigint not null,
  initial_state jsonb not null,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists matches_room_code_idx on matches(room_code);
create index if not exists matches_player_a_idx on matches(player_a_id);
create index if not exists matches_player_b_idx on matches(player_b_id);

-- Match actions (the action log; engine replays to reconstruct state)
create table if not exists match_actions (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  sequence_number int not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  unique(match_id, sequence_number)
);

create index if not exists match_actions_match_seq_idx on match_actions(match_id, sequence_number);

-- Enable Realtime on tables needed for live sync
alter publication supabase_realtime add table match_actions;
alter publication supabase_realtime add table matches;

-- ── Row Level Security ──────────────────────────────────────────────────────

alter table profiles enable row level security;
alter table cards enable row level security;
alter table traits enable row level security;
alter table decks enable row level security;
alter table matches enable row level security;
alter table match_actions enable row level security;

-- profiles
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update using (auth.uid() = id);

create policy "Profiles created on signup"
  on profiles for insert with check (auth.uid() = id);

-- cards
create policy "Anyone can read published cards"
  on cards for select using (status = 'published');

create policy "Admins can manage all cards"
  on cards for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- traits
create policy "Anyone can read traits"
  on traits for select using (true);

create policy "Admins can manage traits"
  on traits for all using (
    exists (select 1 from profiles where id = auth.uid() and is_admin = true)
  );

-- decks
create policy "Users can manage own decks"
  on decks for all using (auth.uid() = user_id);

-- matches
create policy "Participants can view their matches"
  on matches for select using (
    auth.uid() = player_a_id or auth.uid() = player_b_id
  );

create policy "Authenticated users can create a match"
  on matches for insert with check (auth.uid() = player_a_id);

create policy "Participants can update their match"
  on matches for update using (
    auth.uid() = player_a_id or auth.uid() = player_b_id
  );

-- match_actions
create policy "Participants can read match actions"
  on match_actions for select using (
    exists (
      select 1 from matches
      where matches.id = match_actions.match_id
        and (matches.player_a_id = auth.uid() or matches.player_b_id = auth.uid())
    )
  );

create policy "Participants can insert match actions"
  on match_actions for insert with check (
    exists (
      select 1 from matches
      where matches.id = match_actions.match_id
        and (matches.player_a_id = auth.uid() or matches.player_b_id = auth.uid())
    )
  );
