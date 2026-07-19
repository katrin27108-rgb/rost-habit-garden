create or replace function public.create_garden_invitation(p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_token text:=gen_random_uuid()::text; v_invitation uuid; v_result jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select result into v_result from public.sync_operations where operation_id=p_operation_id and user_id=v_user;
  if found then return v_result; end if;
  insert into public.invitations(owner_id,token_hash,expires_at,operation_id) values(v_user,encode(digest(v_token,'sha256'),'hex'),now()+interval '7 days',p_operation_id) returning id into v_invitation;
  v_result=jsonb_build_object('invitation_id',v_invitation,'token',v_token,'expires_at',now()+interval '7 days');
  insert into public.sync_operations(operation_id,user_id,kind,result) values(p_operation_id,v_user,'invitation.create',v_result);
  return v_result;
end $$;

create or replace function public.accept_garden_invitation(p_token text,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_inv public.invitations%rowtype; v_result jsonb;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  select result into v_result from public.sync_operations where operation_id=p_operation_id and user_id=v_user;
  if found then return v_result; end if;
  select * into v_inv from public.invitations where token_hash=encode(digest(p_token,'sha256'),'hex') for update;
  if not found or v_inv.expires_at<now() or v_inv.used_at is not null or v_inv.revoked_at is not null or v_inv.owner_id=v_user then raise exception 'invalid_invitation'; end if;
  update public.invitations set used_by=v_user,used_at=now() where id=v_inv.id;
  insert into public.garden_view_permissions(owner_id,viewer_id,invitation_id) values(v_inv.owner_id,v_user,v_inv.id)
    on conflict(owner_id,viewer_id) do update set revoked_at=null,invitation_id=excluded.invitation_id;
  v_result=jsonb_build_object('owner_id',v_inv.owner_id,'accepted',true);
  insert into public.sync_operations(operation_id,user_id,kind,result) values(p_operation_id,v_user,'invitation.accept',v_result);
  return v_result;
end $$;

create or replace function public.revoke_garden_access(p_viewer_id uuid,p_operation_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_user uuid:=auth.uid(); v_result jsonb:=jsonb_build_object('revoked',true);
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if exists(select 1 from public.sync_operations where operation_id=p_operation_id and user_id=v_user) then return v_result; end if;
  update public.garden_view_permissions set revoked_at=now() where owner_id=v_user and viewer_id=p_viewer_id and revoked_at is null;
  insert into public.sync_operations(operation_id,user_id,kind,payload,result) values(p_operation_id,v_user,'permission.revoke',jsonb_build_object('viewer_id',p_viewer_id),v_result);
  return v_result;
end $$;

create or replace function public.get_guest_garden(p_owner_id uuid)
returns jsonb language plpgsql security definer stable set search_path=public as $$
declare v_viewer uuid:=auth.uid();
begin
  if v_viewer is null or not exists(select 1 from public.garden_view_permissions where owner_id=p_owner_id and viewer_id=v_viewer and revoked_at is null) then raise exception 'not_allowed'; end if;
  return jsonb_build_object(
    'owner_id',p_owner_id,
    'display_name',(select display_name from public.profiles where id=p_owner_id),
    'plants',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'kind',p.kind,'slot',p.garden_slot,'health',p.health,'progress',least(1,coalesce(c.done,0)::numeric/30))), '[]'::jsonb)
      from public.plants p left join (select habit_id,count(*) filter(where deleted_at is null) done from public.completions where user_id=p_owner_id group by habit_id)c on c.habit_id=p.habit_id
      where p.user_id=p_owner_id and p.deleted_at is null),
    'total_completions',(select count(*) from public.completions where user_id=p_owner_id and deleted_at is null),
    'achievements',(select coalesce(jsonb_agg(jsonb_build_object('code',achievement_code,'earned_at',earned_at)),'[]'::jsonb) from public.user_achievements where user_id=p_owner_id)
  );
end $$;

revoke all on function public.create_garden_invitation(uuid) from public;
revoke all on function public.accept_garden_invitation(text,uuid) from public;
revoke all on function public.revoke_garden_access(uuid,uuid) from public;
revoke all on function public.get_guest_garden(uuid) from public;
grant execute on function public.create_garden_invitation(uuid),public.accept_garden_invitation(text,uuid),public.revoke_garden_access(uuid,uuid),public.get_guest_garden(uuid) to authenticated;
