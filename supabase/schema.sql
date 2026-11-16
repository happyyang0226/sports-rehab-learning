create table public.pt_learning_progress (
 user_id uuid not null references auth.users(id) on delete cascade,
 course_id text not null check(course_id in ('sports-rehab','physiology')),
 chapter_id integer not null,
 state jsonb not null,
 revision bigint not null default 1 check(revision>0),
 updated_at timestamptz not null default now(),
 primary key(user_id,course_id,chapter_id),
 constraint pt_learning_chapter_range check(chapter_id between 1 and case when course_id='sports-rehab' then 24 else 14 end),
 constraint pt_learning_state_shape check(jsonb_typeof(state)='object' and state ?& array['answers','submitted'] and jsonb_typeof(state->'answers')='array' and jsonb_array_length(state->'answers')=20 and jsonb_typeof(state->'submitted')='boolean' and octet_length(state::text)<=1048576)
);
alter table public.pt_learning_progress enable row level security;
create policy pt_learning_select_own on public.pt_learning_progress for select to authenticated using((select auth.uid())=user_id);
create policy pt_learning_insert_own on public.pt_learning_progress for insert to authenticated with check((select auth.uid())=user_id);
create policy pt_learning_update_own on public.pt_learning_progress for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
revoke all on public.pt_learning_progress from anon, public;
grant select,insert,update on public.pt_learning_progress to authenticated;
create function public.pt_learning_touch() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.revision:=case when tg_op='INSERT' then 1 else old.revision+1 end;
 new.updated_at:=clock_timestamp();
 return new;
end $$;
revoke execute on function public.pt_learning_touch() from public,anon,authenticated;
create trigger pt_learning_touch_before before insert or update on public.pt_learning_progress for each row execute function public.pt_learning_touch();
create function public.pt_learning_save(p_course_id text,p_chapter_id integer,p_state jsonb,p_expected_revision bigint)
returns setof public.pt_learning_progress language plpgsql security invoker set search_path='' as $$
declare result public.pt_learning_progress; owner_id uuid:=auth.uid();
begin
 if owner_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_expected_revision=0 then
   insert into public.pt_learning_progress(user_id,course_id,chapter_id,state)
   values(owner_id,p_course_id,p_chapter_id,p_state)
   on conflict(user_id,course_id,chapter_id) do nothing returning * into result;
 elsif p_expected_revision>0 then
   update public.pt_learning_progress set state=p_state
   where user_id=owner_id and course_id=p_course_id and chapter_id=p_chapter_id and revision=p_expected_revision
   returning * into result;
 else raise exception 'Invalid revision' using errcode='22023'; end if;
 if result.user_id is null then raise exception 'PT_LEARNING_CONFLICT' using errcode='40001'; end if;
 return next result;
end $$;
revoke execute on function public.pt_learning_save(text,integer,jsonb,bigint) from public,anon;
grant execute on function public.pt_learning_save(text,integer,jsonb,bigint) to authenticated;
comment on table public.pt_learning_progress is 'Private learner chapter snapshots for sports rehabilitation and physiology. Client learning scores are practice summaries, not verified exam grades.';
