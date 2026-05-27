create table if not exists public.users (
    id bigint generated always as identity primary key,
    username text not null,
    password_hash text not null,
    totp_secret text not null,
    created_at timestamptz not null default now(),
    last_used_totp_counter integer,
    pdf_filename text,
    pdf_original_name text,
    pdf_uploaded_at timestamptz
);

create unique index if not exists users_username_lower_idx
    on public.users (lower(username));

insert into storage.buckets (id, name, public)
values ('consent-pdfs', 'consent-pdfs', false)
on conflict (id) do nothing;
