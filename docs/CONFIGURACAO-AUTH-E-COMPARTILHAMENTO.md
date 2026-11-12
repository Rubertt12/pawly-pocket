# Configuração de autenticação e compartilhamento — Pawly Pocket

Este guia registra as configurações externas necessárias para liberar login Google, confirmação de e-mail e convites entre contas.

## 1. Google OAuth

### Google Cloud Console

1. Abra https://console.cloud.google.com/.
2. Selecione ou crie um projeto.
3. Em **APIs e serviços → Tela de consentimento OAuth**, configure o aplicativo como **External** e informe os dados de identificação do Pawly Pocket.
4. Em **APIs e serviços → Credenciais**, crie um **ID do cliente OAuth** do tipo **Aplicativo da Web**.
5. Em **Origens JavaScript autorizadas**, adicione:
   - `https://petal-ruby.vercel.app`
6. Em **URIs de redirecionamento autorizados**, adicione:
   - `https://ulgufqliwypotxwqbwsa.supabase.co/auth/v1/callback`
7. Copie o Client ID e o Client Secret.

Não coloque o Client Secret no código, no GitHub ou em mensagens. Ele deve ser cadastrado somente no painel do Supabase.

### Supabase

1. Abra o projeto `pawly-pocket` (ref. `ulgufqliwypotxwqbwsa`).
2. Acesse **Authentication → Sign In / Providers → Google**.
3. Ative Google e informe Client ID e Client Secret.
4. Salve.

### URLs de autenticação

Em **Authentication → URL Configuration**, confira:

- Site URL: `https://petal-ruby.vercel.app`
- Redirect URL web: `https://petal-ruby.vercel.app/**`
- Redirect URL Android: `com.pawlypocket.app://login-callback/**`

O callback cadastrado no Google continua sendo o endereço do Supabase, não o deep link do Android.

## 2. Confirmação de e-mail

O código já solicita confirmação no cadastro, permite reenviar a confirmação e oferece recuperação de senha.

O remetente SMTP padrão do Supabase pode ser usado apenas em testes restritos. Para permitir cadastro público com entrega confiável, configure um provedor SMTP próprio em **Authentication → SMTP Settings**. Não desative a confirmação de e-mail para contornar a falta de SMTP.

Ao configurar o SMTP, confira também o template de confirmação para que o link use o destino de redirecionamento enviado pelo app (`{{ .RedirectTo }}`) quando aplicável.

## 3. Teste do compartilhamento entre duas contas

1. Na conta A, cadastre um pet.
2. Abra **Configurações → Compartilhar pet**.
3. Informe o e-mail exato da conta B e crie o convite.
4. Envie o link gerado por WhatsApp ou outro canal.
5. Na conta B, abra o link e entre/cadastre-se usando exatamente o e-mail convidado.
6. Confirme que o pet aparece na conta B e que ela consegue editar um registro.
7. Na conta A, remova o acesso e confirme que o pet deixa de aparecer na conta B após a sincronização.

Convites expiram em 7 dias e só podem ser aceitos pelo endereço de e-mail convidado. O participante recebe perfil de editor; o responsável principal pode remover o acesso.

## 4. Limitações atuais

- Perfis e registros dos pets são sincronizados na nuvem.
- Documentos e exames anexados continuam no armazenamento local do aparelho e não são compartilhados entre contas nesta etapa.
- Login Google só funcionará depois de ativar o provedor no Supabase com as credenciais criadas no Google Cloud.
- O envio público de confirmação por e-mail depende de SMTP próprio.
