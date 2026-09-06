begin;
alter table public.letter_decisions drop constraint letter_decisions_visitor_id_key;
alter table public.letter_decisions add column request_id uuid;
alter table public.letter_decisions add constraint letter_decisions_visitor_request_key unique (visitor_id, request_id);
create index letter_decisions_visitor_order_idx on public.letter_decisions (visitor_id, id);
create view public.letter_decision_history with (security_invoker = true) as
select id, visitor_id, participant_name, letter_id, letter_name, duration_ms, submitted_at,
       row_number() over (partition by visitor_id order by id) as choice_order
from public.letter_decisions;
revoke all on public.letter_decision_history from public, anon, authenticated;
grant select on public.letter_decision_history to service_role;
commit;
