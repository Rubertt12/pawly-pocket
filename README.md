# Pawly Pocket

**Seu pet. Sua vida. Tudo no bolso.**

Aplicativo web responsivo para organizar os cuidados e o histórico dos pets.

## Funcionalidades
- Perfis para múltiplos pets
- Carteira de vacinação
- Controle e histórico de cio
- Saúde, consultas, medicamentos e peso
- Reprodução, gestação, parto e filhotes
- Calendário e lembretes recorrentes
- Linha do tempo e busca geral
- Documentos e exames anexados no dispositivo
- Compartilhamento de ficha e relatório para impressão/PDF
- Personalização visual e modo escuro
- Backup e restauração dos dados
- PWA com suporte offline após o primeiro carregamento

## Executar localmente
Abra `index.html` em um servidor estático local. Não há etapa de build.

## Armazenamento e privacidade
Os dados textuais são mantidos no Local Storage do navegador. Os documentos anexados são guardados no IndexedDB do dispositivo. Esta versão não sincroniza dados entre aparelhos nem envia os registros para um servidor.

**Importante:** exporte backups regularmente. Os documentos anexados no IndexedDB precisam de cópia externa separada.

## Tecnologias
HTML, CSS e JavaScript puro; Local Storage, IndexedDB, Service Worker e Web App Manifest.

## Aviso
As previsões e lembretes são organizacionais e não substituem avaliação veterinária.