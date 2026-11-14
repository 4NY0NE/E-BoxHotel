# E-BoxHotel — site do cliente

Reserva de apartamentos à distância e check-in escaneando o QR code da porta do quarto.
Esta é a versão **pública** (somente o site do cliente), pronta para hospedar como site estático.

- Sem build: abra `index.html` ou publique a pasta (Netlify, GitHub Pages…).
- PWA instalável (precisa de HTTPS).
- Contas de clientes: Supabase Auth (a chave pública em `src/core/config.js` é feita para ficar no navegador; a proteção dos dados vem das políticas RLS do banco).
