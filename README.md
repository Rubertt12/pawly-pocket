# Pawly Pocket

**Seu pet. Sua vida. Tudo no bolso.**

Aplicativo de cuidados e histórico dos pets. O projeto está em migração gradual de JavaScript puro para React + Vite, mantendo compatibilidade com os dados locais existentes.

## Estado da migração React

A branch `rebuild/react-js` contém a nova entrada React e a primeira etapa de portabilidade: navegação, visão geral, cadastro básico, controle de cio, registros iniciais e tema claro/escuro. As demais áreas e fluxos avançados ainda precisam ser portados e validados antes de substituir a versão atual.

## Executar localmente

```bash
npm install
npm run dev
```

Para gerar a versão de produção:

```bash
npm run build
npm run preview
```

## Compatibilidade de dados

A chave antiga `petal_data_v1` foi mantida. A leitura inicial reconhece o formato antigo de pet único e o formato com múltiplos pets. Não apagar nem renomear essa chave durante a migração. Antes de liberar a nova versão, validar migração com cópias reais de backup.

## Funcionalidades que precisam de portabilidade e validação

- Carteira de vacinação: todos os campos, reforços e recorrências.
- Saúde: tipos de registro, peso, medicamentos e anexos.
- Reprodução: cobertura, gestação, parto, pós-parto e filhotes.
- Calendário e lembretes recorrentes.
- Linha do tempo, busca geral e central de lembretes.
- Documentos no IndexedDB, abertura, exclusão e vínculo por pet.
- Compartilhamento de ficha e relatório para impressão/PDF.
- Importação de backup antigo e novo, preservando documentos quando possível.
- Preferências do painel e personalização.
- Testes responsivos, acessibilidade e funcionamento offline.

## Arquitetura

- React 19 + Vite.
- Local Storage com compatibilidade da chave legada.
- IndexedDB para anexos (a portar integralmente).
- PWA/Service Worker mantidos durante a fase web.
- Preparação futura para empacotamento Android/iOS via Capacitor.

## Privacidade

Os registros textuais permanecem no dispositivo. A sincronização em nuvem não está habilitada nesta etapa. Faça backups regulares. As previsões de ciclo e lembretes são organizacionais e não substituem avaliação veterinária.
