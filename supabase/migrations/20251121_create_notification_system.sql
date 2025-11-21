-- Device tokens table for storing FCM tokens
create table if not exists public.device_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  device_name text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  unique(user_id, token)
);

-- Sent notifications tracking
create table if not exists public.sent_notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  notification_type text not null, -- 'event_48h', 'event_24h', 'event_1h'
  sent_at timestamp with time zone default now(),
  unique(user_id, event_id, notification_type)
);

-- Notification preferences
create table if not exists public.notification_preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  event_notifications boolean default true,
  message_notifications boolean default true,
  practice_notifications boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Enable RLS
alter table public.device_tokens enable row level security;
alter table public.sent_notifications enable row level security;
alter table public.notification_preferences enable row level security;

-- RLS Policies for device_tokens
create policy "Users can view their own device tokens"
  on public.device_tokens for select
  using (auth.uid() = user_id);

create policy "Users can insert their own device tokens"
  on public.device_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own device tokens"
  on public.device_tokens for delete
  using (auth.uid() = user_id);

-- RLS Policies for sent_notifications
create policy "Users can view sent notifications for their events"
  on public.sent_notifications for select
  using (auth.uid() = user_id);

-- RLS Policies for notification_preferences
create policy "Users can view their own preferences"
  on public.notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert their own preferences"
  on public.notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own preferences"
  on public.notification_preferences for update
  using (auth.uid() = user_id);
