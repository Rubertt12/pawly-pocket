# Pawly Pocket

**Seu pet. Sua vida. Tudo no bolso.**

Aplicativo responsivo para organizar o cuidado e o histórico dos pets. A branch `rebuild/react-js` contém a migração progressiva para React 19 + Vite, mantendo a versão JavaScript original preservada em outra branch.

## Branches

- `archive/vanilla-js-2026-11-10`: snapshot integral da versão anterior em JavaScript puro.
- `rebuild/react-js`: nova implementação React em desenvolvimento.
- `main`: versão oficial, não alterada por esta migração.

## Funcionalidades já portadas para React

- Visão geral com indicadores e card de acompanhamento do cio.
- Cadastro de múltiplos pets, edição de perfil, captura por câmera nativa e seleção da galeria.
- Carteira de vacinação com dose, reforço e lembretes recorrentes.
- Controle de cio, histórico editável e estimativa baseada no histórico.
- Módulo de medicamentos e tratamentos com dosagem prescrita, via, frequência, duração, status e lembretes.
- Rotina de higiene e cuidados com recorrência e próximos agendamentos.
- Agenda de contatos veterinários e clínicas, com telefone, e-mail, endereço e especialidade.
- Álbum de memórias com fotos compactadas e registros por data.
- Relatórios consolidados, impressão/PDF pelo navegador e exportação CSV.
- Carteirinha digital com QR Code gerado localmente no dispositivo.
- Saúde, medicamentos, consultas, peso e exames.
- Reprodução, gestação, parto, pós-parto e filhotes (registros organizacionais).
- Compromissos e calendário mensal com navegação entre meses.
- Linha do tempo e busca geral entre pets.
- Central de lembretes, avisos no navegador e agendamento de notificações locais nativas com Capacitor.
- Documentos e exames anexados no IndexedDB.
- Compartilhamento da ficha e relatório imprimível/PDF.
- Tema claro/escuro e cor principal personalizável.
- Backup completo e restauração JSON, incluindo documentos e exames anexados no IndexedDB.
- PWA e cache offline preservados durante a migração.

## Executar localmente

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
```

## Compatibilidade e armazenamento

A chave legada `petal_data_v1` foi mantida. A leitura reconhece o formato antigo de pet único e o formato com múltiplos pets. Dados textuais continuam no Local Storage; anexos usam o banco IndexedDB `pawly-pocket-files`.

O backup completo exporta os documentos do IndexedDB junto com os registros, mantendo o vínculo com cada pet. A restauração aceita o formato completo e também backups antigos; quando um backup antigo não contém anexos, os documentos que já estão no aparelho são preservados.

## Validação

O workflow GitHub Actions `React build validation` executa `npm install` e `npm run build` na branch React. O bundle de produção é publicado como artifact do workflow. O workflow `Android debug APK` gera um APK de depuração para instalação e testes; ele não é assinado para distribuição na Play Store.

## Preparação para Android e iOS

- Capacitor 8.6 configurado com `@capacitor/core`, CLI, plataformas Android/iOS, identificador `com.pawlypocket.app` e saída web em `dist`.
- Câmera e galeria usam `@capacitor/camera` 8.1+; captura e seleção da galeria estão ligadas ao perfil do pet.
- `@capacitor/app` recupera o resultado da câmera se o Android encerrar o processo enquanto a câmera estiver aberta.
- Documentos usam o seletor de arquivos do sistema (`input type=file`), aceitando PDF e imagens de até 15 MB.
- No Android, a seleção da galeria usa o Photo Picker; o plugin não solicita permissão ampla de armazenamento para esse fluxo.
- No iOS, preencher `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` e `NSPhotoLibraryAddUsageDescription` no `Info.plist` antes da distribuição.
- Para gerar os projetos nativos, executar `npm install`, `npm run build`, `npm run cap:add:android` ou `npm run cap:add:ios` e depois `npm run cap:sync`.
- Android requer Android Studio e Android SDK. iOS requer macOS, Xcode e Xcode Command Line Tools.
- As pastas nativas ainda não foram geradas; não existem APK/AAB ou IPA prontos.

## Próximas etapas

- Testar captura pela câmera e seleção da galeria em Android físico.
- Testar a recuperação do resultado da câmera caso o Android encerre o processo em segundo plano.
- Testar backup completo e restauração com arquivos reais.
- Validar navegação, acessibilidade e responsividade em aparelhos reais.
- Executar o workflow `Android debug APK` e validar o APK em um aparelho físico.

## Privacidade e observação veterinária

Os registros permanecem no dispositivo; sincronização em nuvem não está habilitada. Faça backups regulares. Previsões de cio, lembretes e registros são ferramentas organizacionais e não substituem avaliação veterinária.
