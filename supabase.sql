-- POSTX DATABASE

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

create table if not exists connected_platforms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  platform_user_id text,
  platform_username text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id, platform)
);

create table if not exists upload_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_name text,
  video_size bigint,
  video_path text,
  caption text,
  thumbnail_path text,
  status text default 'queued',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists upload_targets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references upload_jobs(id) on delete cascade,
  platform text not null,
  status text default 'waiting',
  progress numeric default 0,
  speed text,
  remote_post_id text,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table profiles enable row level security;
alter table connected_platforms enable row level security;
alter table upload_jobs enable row level security;
alter table upload_targets enable row level security;

create policy "users own profiles"
on profiles
for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "users own platforms"
on connected_platforms
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users own jobs"
on upload_jobs
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users own targets"
on upload_targets
for all
using (
  exists (
    select 1
    from upload_jobs
    where upload_jobs.id = upload_targets.job_id
    and upload_jobs.user_id = auth.uid()
  )
);
