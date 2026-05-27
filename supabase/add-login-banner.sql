-- Run this in Supabase SQL Editor if login_banner table is missing.

create table if not exists public.login_banner (
    id smallint primary key default 1 check (id = 1),
    is_visible boolean not null default true,
    message_html text not null default '',
    updated_at timestamptz not null default now()
);

insert into public.login_banner (id, is_visible, message_html)
values (
    1,
    true,
    '<b>RealMe create login issue</b><br>
There is currently a known platform issue with "Create a RealMe login", when proceeding, you may receive an "Unable to validate the information" error. As a workaround, continue by attempting to log in using the newly created user details. This will allow you to proceed with completing the user creation process.'
)
on conflict (id) do nothing;

alter table public.login_banner enable row level security;
