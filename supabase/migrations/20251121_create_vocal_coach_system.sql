-- Practice assignments (admin creates these)
create table if not exists public.practice_assignments (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid not null references auth.users(id),
  member_id uuid not null references auth.users(id),
  song_id uuid references public.songs(id),
  voice_part text, -- soprano, alto, tenor, bass
  title text not null,
  description text,
  assigned_at timestamp with time zone default now(),
  due_date timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Practice sessions (individual attempts)
create table if not exists public.practice_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id),
  assignment_id uuid references public.practice_assignments(id),
  audio_url text not null,
  duration_seconds int,
  transcription text,
  created_at timestamp with time zone default now()
);

-- AI-generated feedback
create table if not exists public.practice_feedback (
  id uuid default gen_random_uuid() primary key,
  session_id uuid not null references public.practice_sessions(id) on delete cascade,
  pitch_accuracy float, -- 0-100
  timing_accuracy float, -- 0-100
  tone_quality float, -- 0-100
  breathing_technique text,
  overall_score float,
  strengths text[], -- array of strengths
  improvements text[], -- array of improvements
  ai_feedback text,
  created_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.practice_assignments enable row level security;
alter table public.practice_sessions enable row level security;
alter table public.practice_feedback enable row level security;

-- RLS Policies
create policy "Members can see assignments assigned to them"
  on public.practice_assignments for select
  using (auth.uid() = member_id or auth.uid() = admin_id);

create policy "Admins can create assignments"
  on public.practice_assignments for insert
  with check (auth.uid() = admin_id and (select role from public.users where id = auth.uid()) = 'admin');

create policy "Users can see their own practice sessions"
  on public.practice_sessions for select
  using (auth.uid() = user_id);

create policy "Users can create their own practice sessions"
  on public.practice_sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can see feedback for their sessions"
  on public.practice_feedback for select
  using (
    auth.uid() = (select user_id from public.practice_sessions where id = session_id)
  );
