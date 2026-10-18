# Nexa

Aplicação social construída com Next.js 15, React 19, Supabase, MapLibre e LiveKit.

## O que foi corrigido na união

- arquivos parciais das Partes 8 e 9 foram mesclados com suas versões completas;
- o menu principal, o layout raiz e a página de detalhes do rolê foram restaurados;
- as dependências de MapLibre, LiveKit, Playwright e `server-only` foram adicionadas;
- as telas de solicitações e perfil público foram incluídas;
- as funções SQL usadas por essas telas foram adicionadas na migration `014_unified_repairs.sql`;
- o redirecionamento do callback de autenticação foi limitado a caminhos internos;
- os estilos do MapLibre foram carregados no layout raiz;
- todas as chaves de ambiente foram reunidas em `.env.example`.

## Como iniciar

1. Instale Node.js 22.
2. Rode `npm ci`.
3. Copie `.env.example` para `.env.local` e preencha as chaves.
4. Crie um projeto Supabase vazio e execute as migrations na ordem de `001` até `015`.
5. Rode `npm run dev` e abra `http://localhost:3000`.

## Serviços externos necessários

- Supabase: autenticação, banco, storage e realtime;
- MapLibre: renderização do mapa com dados do OpenStreetMap;
- OpenStreetMap/Nominatim: busca de locais públicos;
- LiveKit: chamadas de áudio e vídeo.

O mapa não exige token do Mapbox. `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` são obrigatórias já no build; as credenciais do LiveKit são necessárias para as chamadas.

## Deploy no Railway

1. Crie um projeto no Railway a partir deste repositório GitHub.
2. Configure no serviço as variáveis listadas em `.env.example`, usando os valores reais de produção.
3. Não envie `.env.local` ou segredos ao Git; o Railway executará `npm run build` e iniciará a aplicação com `npm start`.
4. Após o primeiro deploy, defina `NEXT_PUBLIC_APP_URL` com o domínio público gerado pelo Railway e faça um novo deploy.

O projeto exige Node.js `>=22.22.0 <23` em `package.json`; o servidor Next.js usa automaticamente a variável `PORT` fornecida pelo Railway.

## Validação feita

- build de produção do Next.js concluído;
- 50 rotas e APIs reconhecidas pelo build;
- todos os arquivos JavaScript analisados sem erro de sintaxe;
- todas as migrations analisadas pelo parser oficial do PostgreSQL.

O comportamento completo de autenticação, permissões RLS, realtime, chamadas e mapas ainda precisa ser testado com projetos reais do Supabase e LiveKit.
