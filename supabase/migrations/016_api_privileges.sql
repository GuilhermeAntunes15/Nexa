revoke all privileges on all tables in schema public from public, anon, authenticated, service_role;
revoke all privileges on all sequences in schema public from public, anon, authenticated, service_role;
revoke all privileges on all functions in schema public from public, anon, authenticated, service_role;

grant select on table
  public.profiles,
  public.interests,
  public.profile_interests,
  public.profile_goals,
  public.privacy_settings,
  public.user_presence,
  public.connection_requests,
  public.conversation_members,
  public.messages,
  public.calls,
  public.activities,
  public.activity_members,
  public.activity_invites,
  public.sos_requests,
  public.sos_responses,
  public.trust_metrics,
  public.notifications,
  public.guardian_links,
  public.meeting_sessions,
  public.meeting_verifications,
  public.meeting_checkins,
  public.feed_posts,
  public.feed_reactions
to authenticated;

grant insert on table
  public.profile_interests,
  public.profile_goals,
  public.guardian_links
to authenticated;

grant update on table
  public.profiles,
  public.guardian_links
to authenticated;

grant delete on table
  public.profile_interests,
  public.profile_goals
to authenticated;

grant select on table
  public.user_roles,
  public.calls,
  public.conversation_members,
  public.guardian_meeting_approvals,
  public.meeting_sessions,
  public.profiles,
  public.guardian_links,
  public.meeting_participants,
  public.meeting_verifications,
  public.guardian_share_sessions
to service_role;

grant insert on table
  public.guardian_meeting_approvals,
  public.guardian_share_sessions
to service_role;

grant update on table
  public.guardian_meeting_approvals,
  public.guardian_share_sessions,
  public.meeting_verifications
to service_role;

grant execute on function public.accept_connection_request(uuid) to authenticated;
grant execute on function public.accept_sos_help(uuid) to authenticated;
grant execute on function public.are_connected(uuid,uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.cancel_connection_request(uuid) to authenticated;
grant execute on function public.can_see_map_presence(uuid,uuid) to authenticated;
grant execute on function public.can_socially_interact(uuid,uuid) to authenticated;
grant execute on function public.comment_feed_post(uuid,text) to authenticated;
grant execute on function public.complete_meeting(uuid) to authenticated;
grant execute on function public.complete_sos(uuid) to authenticated;
grant execute on function public.create_activity(text,text,text,text,timestamptz,timestamptz,integer,text,text,text) to authenticated;
grant execute on function public.create_feed_post(text,text,text) to authenticated;
grant execute on function public.create_sos(text,text,text,timestamptz,text,text) to authenticated;
grant execute on function public.decline_connection_request(uuid) to authenticated;
grant execute on function public.end_call(uuid) to authenticated;
grant execute on function public.finish_onboarding() to authenticated;
grant execute on function public.get_activity_details(uuid) to authenticated;
grant execute on function public.get_activity_feed(integer) to authenticated;
grant execute on function public.get_connection_state(uuid) to authenticated;
grant execute on function public.get_conversation_details(uuid) to authenticated;
grant execute on function public.get_conversation_messages(uuid,timestamptz,integer) to authenticated;
grant execute on function public.get_feed_posts(integer) to authenticated;
grant execute on function public.get_meeting_room(uuid) to authenticated;
grant execute on function public.get_my_activity_invites() to authenticated;
grant execute on function public.get_my_blocked_users() to authenticated;
grant execute on function public.get_my_connection_requests() to authenticated;
grant execute on function public.get_my_connections() to authenticated;
grant execute on function public.get_my_conversations() to authenticated;
grant execute on function public.get_my_guardian() to authenticated;
grant execute on function public.get_my_notifications(integer) to authenticated;
grant execute on function public.get_my_sos_requests() to authenticated;
grant execute on function public.get_nearby_profiles(integer,text,boolean,bigint[]) to authenticated;
grant execute on function public.get_public_profile(uuid) to authenticated;
grant execute on function public.get_sos_feed(integer) to authenticated;
grant execute on function public.get_sos_responses(uuid) to authenticated;
grant execute on function public.get_unread_notification_count() to authenticated;
grant execute on function public.invite_to_activity(uuid,uuid) to authenticated;
grant execute on function public.is_conversation_member(uuid,uuid) to authenticated;
grant execute on function public.is_meeting_participant(uuid,uuid) to authenticated;
grant execute on function public.is_minor(uuid) to authenticated;
grant execute on function public.join_activity(uuid) to authenticated;
grant execute on function public.leave_activity(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.meeting_checkin(uuid,text) to authenticated;
grant execute on function public.offer_sos_help(uuid) to authenticated;
grant execute on function public.request_call(uuid,text) to authenticated;
grant execute on function public.request_connection(uuid,text) to authenticated;
grant execute on function public.respond_activity_invite(uuid,text) to authenticated;
grant execute on function public.respond_call(uuid,boolean) to authenticated;
grant execute on function public.send_message(uuid,text,text,text,uuid) to authenticated;
grant execute on function public.set_my_location(double precision,double precision,double precision) to authenticated;
grant execute on function public.set_presence(text) to authenticated;
grant execute on function public.set_visibility(text) to authenticated;
grant execute on function public.start_meeting(uuid) to authenticated;
grant execute on function public.submit_report(uuid,text,text,text,uuid,text) to authenticated;
grant execute on function public.toggle_feed_reaction(uuid) to authenticated;
grant execute on function public.toggle_message_reaction(uuid,text) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.update_my_privacy(text,text,text) to authenticated;
grant execute on function public.users_blocked(uuid,uuid) to authenticated;

grant execute on function public.service_create_meeting_from_activity(uuid,uuid,timestamptz,text,text,text,text,double precision,double precision,text[]) to service_role;
grant execute on function public.service_guardian_share_snapshot(text) to service_role;
grant execute on function public.service_admin_reports(text) to service_role;
grant execute on function public.service_resolve_report(uuid,text,uuid,text) to service_role;
