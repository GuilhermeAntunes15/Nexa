do $$
declare table_name text;
begin
 foreach table_name in array array['messages','connection_requests','notifications','activity_invites','activity_members','sos_responses','user_presence','calls'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
   execute format('alter publication supabase_realtime add table public.%I',table_name);
  end if;
 end loop;
end $$;

insert into public.interests(name,slug,icon) values
('Música','music','music'),('Cinema','cinema','film'),('Tecnologia','technology','code'),('Estudos','studies','book-open'),('Academia','gym','dumbbell'),('Corrida','running','footprints'),('Skate','skate','circle-dot'),('Fotografia','photography','camera'),('Arte','art','palette'),('Games','games','gamepad-2'),('Anime','anime','sparkles'),('Moda','fashion','shirt'),('Empreendedorismo','business','briefcase-business'),('Programação','programming','terminal'),('Idiomas','languages','languages'),('Culinária','cooking','utensils'),('Viagens','travel','plane'),('Livros','books','library'),('Dança','dance','music-2'),('Esportes','sports','trophy') on conflict(slug) do nothing;

insert into public.help_skills(name,slug) values
('Currículo','resume'),('Entrevista','interview'),('Estudos','studies'),('Faculdade','college'),('Tecnologia','technology'),('Programação','programming'),('Trabalho','work'),('Eventos','events'),('Companhia','company'),('Conversa','conversation'),('Orientação','guidance') on conflict(slug) do nothing;
