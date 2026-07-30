-- Beschränkt neue Registrierungen (auth.users) auf eine feste Liste erlaubter
-- E-Mail-Adressen. Bereits bestehende Konten sind davon nicht betroffen.
--
-- Einmalig im Supabase SQL-Editor ausführen (Dashboard -> SQL Editor -> New query).

create or replace function public.restrict_signup_emails()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) not in (
    'flurin_capaul_7@hotmail.com',
    'franzi.14@hotmail.com'
  ) then
    raise exception 'Registrierung für diese E-Mail-Adresse ist nicht erlaubt.';
  end if;
  return new;
end;
$$;

drop trigger if exists restrict_signup_emails_trigger on auth.users;

create trigger restrict_signup_emails_trigger
before insert on auth.users
for each row execute function public.restrict_signup_emails();
