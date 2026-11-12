create or replace function private.guard_pet_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'O identificador do pet não pode ser alterado.'
      using errcode = '42501';
  end if;

  if new.user_id is distinct from old.user_id
     and old.user_id is distinct from (select auth.uid()) then
    raise exception 'Somente o responsável principal pode transferir a propriedade do pet.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function private.guard_pet_identity() from public, anon, authenticated;

drop trigger if exists guard_pet_identity_before_update on public.pets;

create trigger guard_pet_identity_before_update
before update of id, user_id on public.pets
for each row
execute function private.guard_pet_identity();
