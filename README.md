# Pawly Pocket

**Seu pet. Sua vida. Tudo no bolso.**

Aplicativo responsivo para organizar o cuidado e o histórico dos pets. A branch `rebuild/react-js` contém a migração progressiva para React 19 + Vite, mantendo a versão JavaScript original preservada em outra branch.

## Branches

- `archive/vanilla-js-2026-11-10`: snapshot integral da versão anterior em JavaScript puro.
- `rebuild/react-js`: nova implementação React em desenvolvimento.
- `main`: versão oficial, não alterada por esta migração.

## Funcionalidades já portadas para React

- Visão geral com indicadores e card de acompanhamento do cio.
- Cadastro de múltiplos pets, edição de perfil e foto.
- Carteira de vacinação com dose, reforço e lembretes recorrentes.
- Controle de cio, histórico editável e estimativa baseada no histórico.
- Saúde, medicamentos, consultas, peso e exames.
- Reprodução, gestação, parto, pós-parto e filhotes (registros organizacionais).
- Compromissos e calendário mensal com navegação entre meses.
- Linha do tempo e busca geral entre pets.
- Central de lembretes.
- Documentos e exames anexados no IndexedDB.
- Compartilhamento da ficha e relatório imprimível/PDF.
- Tema claro/escuro e cor principal personalizável.
- Backup e restauração JSON para dados textuais.
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

O backup JSON ainda não inclui os binários dos documentos anexados. Antes de substituir a versão atual, é obrigatório validar migração com cópias reais de backup e confirmar que os documentos continuam vinculados aos pets corretos.

## Validação

O workflow GitHub Actions `React build validation` executa `npm install` e `npm run build` na branch React. O bundle de produção é publicado como artifact do workflow.

## Próximas etapas

- Conferir o resultado do build automatizado e corrigir erros.
- Testes funcionais com backup real da versão antiga.
- Validar navegação, acessibilidade e responsividade em aparelhos reais.
- Completar a migração dos fluxos que ainda diferem da versão anterior.
- Preparar Capacitor e gerar builds Android/iOS.
- Só então criar preview público e planejar substituição da versão web oficial.

## Privacidade e observação veterinária

Os registros permanecem no dispositivo; sincronização em nuvem não está habilitada. Faça backups regulares. Previsões de cio, lembretes e registros são ferramentas organizacionais e não substituem avaliação veterinária.
