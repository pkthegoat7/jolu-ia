# Mobile App Setup (PWA + Android)

## 1) PWA (instalavel no celular)

1. Rode o frontend em HTTPS (deploy recomendado).
2. Garanta os icones do manifest:
   - `public/icon-192x192.png`
   - `public/icon-512x512.png`
3. No celular, abra o site e toque em "Adicionar a tela inicial".

## 2) Android com Capacitor

### Primeira vez

```bash
npm run build
npm run mobile:add:android
```

### Sincronizar mudancas

```bash
npm run build
npm run mobile:sync
npm run mobile:open:android
```

## Opcional: usar URL hospedada no app

Defina a variavel `CAPACITOR_SERVER_URL` com sua URL HTTPS de producao antes de sincronizar:

```bash
$env:CAPACITOR_SERVER_URL="https://seu-app.com"
npm run mobile:sync
```

Sem essa variavel, o Capacitor usa os arquivos locais de build.
