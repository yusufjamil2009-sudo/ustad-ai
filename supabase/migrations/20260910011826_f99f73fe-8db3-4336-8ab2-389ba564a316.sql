alter table public.ustad_rank_awards
  add column if not exists status text not null default 'pending';

update public.ustad_rank_awards
   set status = 'paid'
 where status = 'pending' and transaction_id is not null;

alter table public.ustad_certificates
  add column if not exists reference_key text;

do $$
begin
  update public.ustad_certificates
     set reference_key = metadata ->> 'reference'
   where reference_key is null and metadata ? 'reference';

  with ranked as (
    select id,
           row_number() over (
             partition by guest_id, reference_key
             order by issued_at asc, id asc
           ) as rn
      from public.ustad_certificates
     where reference_key is not null
  )
  update public.ustad_certificates c
     set reference_key = null
    from ranked r
   where c.id = r.id and r.rn > 1;
end $$;

create unique index if not exists ustad_certificates_reference_uidx
  on public.ustad_certificates (guest_id, reference_key)
  where reference_key is not null;