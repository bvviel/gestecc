# Documentacao da POC - GESTEC

## 1. Visao geral do projeto

O GESTEC e um sistema de gestao escolar desenvolvido para auxiliar a organizacao administrativa da ETEC Dra. Maria Augusta Saraiva. A proposta da POC foi criar uma aplicacao web capaz de centralizar informacoes importantes da rotina escolar, como professores, solicitacoes de cadastro, avisos, horarios, reservas, substituicoes, notificacoes e contratos.

O sistema foi estruturado como uma aplicacao full stack usando Next.js. Isso significa que o frontend e o backend ficam no mesmo projeto, mas separados por responsabilidade. O frontend cuida das telas e interacoes do usuario. O backend cuida das APIs, regras de negocio, autenticacao e comunicacao com o banco de dados.

O projeto foi versionado no GitHub, hospedado na Vercel e conectado a um banco de dados em nuvem no Supabase.

## 2. Arquitetura geral

A arquitetura do projeto foi organizada em quatro partes principais:

- Frontend: interface visual do sistema, feita com Next.js, React, TypeScript e Tailwind CSS.
- Backend: rotas de API internas do Next.js, responsaveis por login, cadastro, aprovacoes e operacoes do sistema.
- Banco de dados: Supabase/PostgreSQL, onde ficam armazenadas as informacoes reais do sistema.
- Deploy e versionamento: GitHub para guardar o codigo e Vercel para publicar o site online.

Fluxo simplificado:

1. O usuario acessa o site publicado na Vercel.
2. O frontend exibe as telas de login, cadastro, painel da gestao ou painel do professor.
3. Quando o usuario faz uma acao, o frontend chama uma API interna do Next.js.
4. A API valida a sessao, verifica permissoes e executa a regra de negocio.
5. O backend consulta ou altera dados no Supabase.
6. O frontend recebe a resposta atualizada e muda a tela automaticamente.

## 3. Estrutura de pastas do projeto

O projeto fica organizado principalmente dentro da pasta `src`.

### `src/app`

A pasta `src/app` pertence ao App Router do Next.js. Ela define as paginas, layouts e APIs do sistema.

Arquivos principais:

- `src/app/page.tsx`: pagina inicial do sistema. Ela renderiza o componente principal `GesteccApp`.
- `src/app/layout.tsx`: estrutura base HTML da aplicacao.
- `src/app/globals.css`: estilos globais, tema claro/escuro, configuracoes visuais e base do Tailwind CSS.
- `src/app/api/auth/route.ts`: API de autenticacao e solicitacao de cadastro.
- `src/app/api/app/route.ts`: API principal do sistema logado.

### `src/components`

A pasta `src/components` guarda componentes visuais do frontend.

O principal arquivo e:

- `src/components/gestecc-app.tsx`

Esse arquivo concentra a maior parte da interface do GESTEC. Nele foram criadas as telas de login, cadastro de professor, painel geral, painel da gestao, painel do professor, notificacoes, formularios, tabelas, filtros, tema claro/escuro e interacoes da aplicacao.

### `src/lib`

A pasta `src/lib` guarda funcoes internas, tipos, seguranca e integracao com o banco.

Arquivos principais:

- `src/lib/types.ts`: define os tipos usados pelo sistema, como professor, aula, aviso, reserva, notificacao e sessao.
- `src/lib/store.ts`: centraliza as regras de negocio e as operacoes com os dados.
- `src/lib/security.ts`: cuida de hash de senha, criacao de sessao e validacao de token.
- `src/lib/supabase-server.ts`: cria a conexao segura do backend com o Supabase.
- `src/lib/demo-data.ts`: contem dados locais usados quando o Supabase nao esta configurado.

## 4. Frontend

### Next.js

O Next.js foi usado como framework principal do projeto. Ele serviu para organizar a aplicacao, criar paginas, permitir rotas de API e facilitar a publicacao na Vercel.

No frontend, o Next.js e responsavel por carregar a pagina principal do site. O arquivo `src/app/page.tsx` chama o componente `GesteccApp`, que e a interface principal do sistema.

### React

O React foi usado para construir as telas e componentes interativos. Com ele, foi possivel criar uma interface dinamica, onde os dados mudam sem precisar recarregar a pagina inteira.

Exemplos de partes feitas com React:

- alternancia entre login de gestor e professor;
- formulario de solicitacao de cadastro;
- painel geral;
- abas da gestao;
- abas do professor;
- abertura e fechamento de formularios;
- filtros de horarios;
- leitura de notificacoes;
- upload de foto de perfil;
- alternancia entre tema claro e escuro.

### TypeScript

O TypeScript foi usado para deixar o codigo mais organizado e seguro. Ele permite definir formatos esperados para os dados do sistema.

Por exemplo, em `src/lib/types.ts`, existem tipos para:

- `Teacher`: professor aprovado;
- `TeacherRequest`: solicitacao de cadastro;
- `Schedule`: aula/horario;
- `Notice`: aviso;
- `Reservation`: reserva;
- `Notification`: notificacao;
- `SessionClaims`: dados da sessao logada.

Isso ajuda a evitar erros, porque o codigo sabe quais campos cada objeto deve ter.

### Tailwind CSS

O Tailwind CSS foi usado para construir o design visual do sistema. Ele serviu para definir cores, espacamentos, bordas, sombras, responsividade, tema claro/escuro e animacoes.

No GESTEC, ele foi usado para criar uma interface limpa, moderna e responsiva, com:

- cards de resumo;
- tabelas;
- botoes com animacao;
- formularios;
- abas;
- estados de hover;
- modo escuro real;
- layout adaptado para telas diferentes.

### Lucide React

O Lucide React foi usado para inserir icones na interface. Os icones ajudam o usuario a entender a funcao de cada botao ou area do sistema.

Exemplos:

- sino para notificacoes;
- calendario para horarios;
- usuario para perfil;
- lixeira para exclusao;
- lapis para edicao;
- sol/lua para tema claro/escuro.

### Tema claro e escuro

O modo claro/escuro foi feito no frontend com estado do React e `localStorage`.

Quando o usuario troca o tema, o sistema salva a preferencia no navegador. Assim, quando ele volta ao site, o tema escolhido anteriormente e carregado de novo.

Tecnica usada:

- o estado `theme` controla se o modo atual e `light` ou `dark`;
- o valor e salvo em `localStorage`;
- a classe `dark` e aplicada no elemento HTML;
- o Tailwind usa essa classe para trocar as cores da interface.

### Sessao no frontend

Quando o usuario faz login, o backend retorna um token de sessao. O frontend salva esse token no `localStorage` como sessao local.

Esse token e enviado nas chamadas para a API `/api/app` usando o cabecalho:

`Authorization: Bearer <token>`

Assim, o backend consegue saber se o usuario esta logado e se ele e gestor ou professor.

## 5. Backend

### Next.js API Routes

O backend foi feito com as rotas de API do proprio Next.js. Isso permitiu criar o backend dentro do mesmo projeto do frontend.

As duas APIs principais sao:

- `/api/auth`
- `/api/app`

Essas APIs ficam em:

- `src/app/api/auth/route.ts`
- `src/app/api/app/route.ts`

### API `/api/auth`

A API `/api/auth` cuida das funcoes de autenticacao.

Ela recebe requisicoes de:

- login da gestao;
- login do professor;
- solicitacao de cadastro de professor.

Como funciona:

1. O frontend envia um corpo JSON informando o modo da acao.
2. Se o modo for `manager`, a API chama `loginManager`.
3. Se o modo for `teacher`, a API chama `loginTeacher`.
4. Se o modo for `requestAccess`, a API chama `createTeacherRequest`.
5. A resposta volta para o frontend com sucesso, erro ou status pendente.

### API `/api/app`

A API `/api/app` cuida das funcoes internas depois que o usuario esta logado.

Ela possui dois comportamentos principais:

- `GET`: busca um snapshot completo dos dados que o usuario pode ver.
- `POST`: executa uma acao, como aprovar professor, criar aviso, criar aula ou aprovar reserva.

Antes de executar qualquer acao, essa API valida o token recebido no cabecalho `Authorization`.

Se o token for invalido ou estiver expirado, a API retorna erro de sessao invalida.

### `store.ts` como camada de regras de negocio

O arquivo `src/lib/store.ts` funciona como a principal camada de regras de negocio do sistema.

Ele concentra funcoes como:

- `loginManager`;
- `loginTeacher`;
- `createTeacherRequest`;
- `approveRequest`;
- `rejectRequest`;
- `performAction`;
- criacao, edicao e exclusao de aulas;
- criacao e exclusao de avisos;
- criacao e aprovacao de reservas;
- leitura de notificacoes;
- exclusao de professores;
- atualizacao de foto de perfil.

A ideia foi manter as regras principais em um lugar central, para evitar que a logica ficasse espalhada pelo frontend.

### Validacao de permissoes

Algumas acoes so podem ser feitas pela gestao. Por exemplo:

- aprovar professor;
- recusar professor;
- remover professor;
- criar aviso;
- criar aula;
- editar aula;
- apagar aula;
- aprovar reserva.

O backend valida isso usando os dados da sessao. Se um professor tentar executar uma acao exclusiva da gestao, a API retorna erro.

### Regra de conflito de aulas

Foi criada uma regra para horarios escolares:

Se a gestao cadastrar uma aula no mesmo dia, no mesmo periodo e com a mesma disciplina de uma aula ja existente, a aula anterior e substituida pela nova.

Isso foi feito no backend para garantir que a regra funcione independentemente da tela usada. A logica procura conflitos na grade e atualiza/remove a aula antiga quando necessario.

Essa regra evita duplicidade de aulas impossiveis na mesma disciplina, dia e periodo.

## 6. Autenticacao e seguranca

### Login da gestao

O login da gestao nao fica salvo no banco de dados. Ele e configurado por variaveis de ambiente no servidor.

Isso foi feito para manter a conta administrativa separada dos cadastros comuns de professores.

Quando a gestao faz login:

1. O frontend envia usuario e senha para `/api/auth`.
2. O backend compara com as credenciais configuradas no ambiente seguro.
3. Se estiver correto, o backend cria um token de sessao com papel `manager`.
4. O frontend salva a sessao e mostra o painel da gestao.

### Login do professor

O login do professor e baseado no banco de dados.

O professor so consegue entrar se ja existir na tabela `teachers`, ou seja, se ja tiver sido aprovado pela gestao.

Fluxo:

1. O professor informa e-mail e senha.
2. O backend procura o e-mail na tabela `teachers`.
3. Se encontrar, compara a senha informada com o hash salvo no banco.
4. Se a senha estiver correta, cria uma sessao com papel `teacher`.
5. O professor entra no painel dele.

### Solicitacao pendente

Quando um professor cria uma conta, ele nao entra automaticamente no sistema.

Primeiro, os dados sao salvos na tabela `teacher_requests` com status `pending`.

Quando ele tenta logar antes da aprovacao, o backend consulta essa tabela e informa que o acesso ainda esta pendente de aprovacao pela gestao.

### Aprovacao pela gestao

Quando a gestao aprova uma solicitacao:

1. O backend busca a solicitacao em `teacher_requests`.
2. O status da solicitacao e alterado para `approved`.
3. Um novo registro e criado na tabela `teachers`.
4. A senha criptografada e reaproveitada para o professor aprovado.
5. O professor passa a conseguir fazer login.
6. Uma notificacao e enviada para o professor.

### Recusa pela gestao

Se a gestao recusar:

1. O status em `teacher_requests` muda para `rejected`.
2. O professor nao e criado na tabela `teachers`.
3. Se tentar logar, recebe mensagem informando que a solicitacao foi recusada.

### Hash de senha

As senhas dos professores nao sao salvas em texto puro.

O arquivo `src/lib/security.ts` usa PBKDF2 com SHA-256 para gerar um hash seguro da senha. O banco guarda apenas esse hash.

Na hora do login, o sistema nao descriptografa a senha. Ele calcula novamente o hash da senha digitada e compara com o hash salvo.

### Token de sessao

A sessao do usuario e feita com um token assinado por HMAC SHA-256.

Esse token contem:

- papel do usuario (`manager` ou `teacher`);
- nome;
- e-mail;
- id do professor, quando for professor;
- data de expiracao.

O token expira apos 12 horas.

## 7. Banco de dados

### Supabase

O Supabase foi usado como plataforma de banco de dados em nuvem. Ele hospeda o PostgreSQL usado pelo sistema.

O frontend nao acessa o banco diretamente. As operacoes passam pelas APIs do backend, que usam uma conexao segura com o Supabase no servidor.

### PostgreSQL

O PostgreSQL e o banco relacional usado dentro do Supabase.

Ele foi escolhido porque permite organizar dados em tabelas, criar relacoes, aplicar regras, indices e politicas de seguranca.

### Schema SQL

A estrutura do banco foi definida no arquivo:

`supabase/schema.sql`

Esse arquivo cria as tabelas, indices, politicas de seguranca e dados iniciais, como as 47 salas.

### Tabela `teacher_requests`

Guarda as solicitacoes de cadastro dos professores.

Campos principais:

- nome completo;
- disciplina;
- e-mail;
- hash da senha;
- tipo de contrato;
- status (`pending`, `approved`, `rejected`);
- motivo de recusa;
- data de criacao;
- data de revisao.

Essa tabela permite que o professor solicite acesso, mas fique aguardando a aprovacao da gestao.

### Tabela `teachers`

Guarda os professores aprovados.

Campos principais:

- nome completo;
- disciplina;
- e-mail unico;
- hash da senha;
- tipo de contrato;
- inicio do contrato;
- fim do contrato, quando for nao concursado;
- status do contrato;
- foto de perfil.

Somente professores nessa tabela conseguem fazer login no sistema.

### Tabela `rooms`

Guarda as salas da escola.

Foram cadastradas 47 salas. Cada sala possui:

- nome;
- tipo;
- status;
- professor atual, quando estiver ocupada ou reservada;
- turma atual;
- periodo atual;
- data de atualizacao.

### Tabela `notices`

Guarda os avisos publicados pela gestao.

Cada aviso possui:

- titulo;
- corpo/descricao;
- categoria;
- data de expiracao opcional;
- data de criacao.

Esses avisos aparecem no mural do painel geral.

### Tabela `substitutions`

Guarda substituicoes do dia.

Ela armazena:

- data;
- professor original;
- professor substituto;
- disciplina;
- turma;
- sala.

Essas informacoes aparecem no painel geral e ajudam na organizacao diaria.

### Tabela `schedules`

Guarda as aulas e horarios criados pela gestao.

Cada aula possui:

- professor;
- nome do professor;
- disciplina;
- turma;
- sala;
- dia da semana;
- periodo;
- horario de inicio;
- horario de fim.

Essa tabela alimenta tanto a grade geral da gestao quanto o painel do professor. O professor ve apenas as aulas ligadas ao seu proprio id.

### Tabela `reservations`

Guarda reservas de sala feitas por professores.

Campos principais:

- professor;
- sala;
- data;
- horario de inicio;
- horario de fim;
- motivo;
- status (`pending`, `approved`, `rejected`).

A gestao pode aprovar ou recusar essas reservas.

### Tabela `notifications`

Guarda notificacoes enviadas aos usuarios.

Ela registra:

- publico-alvo (`manager` ou `teacher`);
- professor especifico, quando for notificacao individual;
- titulo;
- mensagem;
- tipo da notificacao;
- data de leitura;
- dados extras da notificacao;
- data de criacao.

Essa tabela permite mostrar o sininho de notificacoes e marcar notificacoes como lidas.

### Indices

Foram criados indices para melhorar consultas frequentes, como:

- busca por e-mail de professor;
- solicitacoes por status;
- horarios por professor e dia;
- reservas por professor e data;
- notificacoes por publico-alvo.

Os indices ajudam o banco a responder mais rapido quando o volume de dados crescer.

### RLS - Row Level Security

Todas as tabelas principais possuem RLS ativado.

O objetivo e impedir acesso direto e inseguro as tabelas por usuarios comuns. As operacoes reais passam pelas APIs do backend, que executam as regras de permissao antes de acessar o banco.

## 8. Integracao com Supabase

A conexao com o Supabase fica em:

`src/lib/supabase-server.ts`

Esse arquivo cria um cliente administrativo do Supabase apenas no servidor.

Ele verifica se o ambiente possui as configuracoes necessarias. Se estiver configurado, usa o Supabase real. Se nao estiver, o projeto consegue rodar em modo local com dados temporarios de desenvolvimento.

Esse desenho foi usado para facilitar desenvolvimento e testes sem quebrar o app caso o banco nao esteja conectado localmente.

## 9. GitHub

O GitHub foi usado como repositorio principal do projeto.

Ele serviu para:

- guardar o codigo-fonte;
- versionar mudancas;
- registrar commits;
- permitir historico de evolucao;
- conectar o projeto com a Vercel;
- facilitar colaboracao com outros integrantes do squad.

Cada alteracao importante foi salva em um commit. Depois, o codigo foi enviado para o GitHub com push.

O repositorio contem:

- codigo do frontend;
- codigo do backend;
- APIs;
- schema do banco;
- documentacao;
- configuracoes do projeto.

Arquivos sensiveis, como `.env.local`, nao devem ser enviados ao GitHub.

## 10. Vercel

A Vercel foi usada para hospedar o site online.

Ela pega o codigo do GitHub, instala dependencias, executa o build do Next.js e publica a aplicacao.

No projeto, a Vercel executa:

- build do Next.js;
- hospedagem das paginas;
- execucao das APIs server-side;
- leitura das variaveis de ambiente seguras;
- publicacao do dominio de producao.

Como o projeto esta conectado ao GitHub, cada push pode gerar uma nova versao publicada.

## 11. Variaveis de ambiente

As variaveis de ambiente foram usadas para guardar configuracoes sensiveis fora do codigo.

Elas servem para:

- conectar o backend ao banco;
- guardar credenciais administrativas;
- assinar sessoes;
- proteger chaves que nao devem aparecer no navegador nem no GitHub.

Essas informacoes ficam configuradas localmente ou no painel da Vercel, nao no repositorio.

## 12. Principais fluxos do sistema

### Fluxo de cadastro de professor

1. Professor preenche nome, disciplina, e-mail, senha e tipo de contrato.
2. Frontend envia os dados para `/api/auth`.
3. Backend cria uma solicitacao em `teacher_requests`.
4. A solicitacao fica com status `pending`.
5. Gestao recebe notificacao.
6. Gestao aprova ou recusa.
7. Se aprovar, professor e criado em `teachers`.
8. Professor passa a conseguir fazer login.

### Fluxo de login

1. Usuario informa credenciais.
2. Frontend envia para `/api/auth`.
3. Backend valida os dados.
4. Se for gestor, valida pelas credenciais do ambiente seguro.
5. Se for professor, valida pelo banco.
6. Backend gera token de sessao.
7. Frontend salva a sessao e exibe o painel correto.

### Fluxo de avisos

1. Gestao cria aviso no painel.
2. Frontend envia acao para `/api/app`.
3. Backend valida sessao de gestor.
4. Aviso e salvo em `notices`.
5. Painel geral exibe o aviso para usuarios logados.

### Fluxo de horarios

1. Gestao cria uma aula com disciplina, professor, turma, sala, dia e periodo.
2. Backend valida se o professor pertence a disciplina escolhida.
3. Aula e salva em `schedules`.
4. Se houver conflito de mesmo dia, periodo e disciplina, a aula anterior e substituida.
5. Professor recebe notificacao.
6. Aula aparece na grade da gestao e no painel do professor.

### Fluxo de reservas

1. Professor solicita uma reserva de sala.
2. Reserva entra em `reservations` com status `pending`.
3. Gestao recebe notificacao.
4. Gestao aprova ou recusa.
5. Professor recebe notificacao com o resultado.

### Fluxo de notificacoes

1. Backend cria notificacoes quando eventos importantes acontecem.
2. Frontend mostra as notificacoes no icone de sino.
3. Ao clicar, a notificacao pode ser marcada como lida.
4. Tambem existe opcao para marcar todas como lidas.

## 13. Tecnologias usadas e suas funcoes

### Frontend

- Next.js: estrutura da aplicacao e renderizacao da pagina principal.
- React: construcao dos componentes e interacoes.
- TypeScript: tipagem dos dados e reducao de erros.
- Tailwind CSS: design, responsividade, tema claro/escuro e animacoes.
- Lucide React: icones da interface.
- LocalStorage: persistencia local de tema e sessao.

### Backend

- Next.js API Routes: criacao das APIs internas.
- Node.js: ambiente de execucao das APIs.
- TypeScript: organizacao e seguranca do codigo backend.
- Crypto do Node.js: hash de senha e assinatura de sessao.
- Camada `store.ts`: regras de negocio e comunicacao com dados.

### Banco de dados

- Supabase: plataforma em nuvem usada para hospedar o banco.
- PostgreSQL: banco relacional usado para guardar os dados.
- SQL: criacao do schema, tabelas, indices e politicas.
- RLS: seguranca para bloquear acesso direto indevido.

### Versionamento e deploy

- GitHub: armazenamento e historico do codigo.
- Git: commits, branches e push.
- Vercel: hospedagem, build e publicacao online.

## 14. Conclusao

A POC do GESTEC demonstra um sistema escolar funcional com frontend, backend e banco de dados integrados. O projeto permite gerenciar professores, solicitacoes de acesso, horarios, avisos, reservas, notificacoes e informacoes escolares em um unico ambiente.

O frontend foi feito para ser moderno e simples de usar. O backend centraliza as regras de negocio e protege o acesso aos dados. O banco de dados organiza as informacoes em tabelas relacionais. O GitHub registra o historico do desenvolvimento, enquanto a Vercel publica o sistema online e o Supabase armazena os dados reais.

Essa estrutura torna o projeto adequado para evoluir futuramente, adicionando novas funcionalidades, melhorando permissoes, criando relatorios e expandindo o uso dentro da escola.
