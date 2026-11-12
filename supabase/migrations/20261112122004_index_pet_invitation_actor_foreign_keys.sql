create index if not exists pet_invitations_invited_by_idx
  on public.pet_invitations (invited_by);

create index if not exists pet_members_invited_by_idx
  on public.pet_members (invited_by);
