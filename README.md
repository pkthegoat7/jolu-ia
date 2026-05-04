# Jolu AI — Skin Analysis Platform

Plataforma open-source de análise de pele por IA para clínicas e profissionais de estética. Captura leads via link de campanha, realiza diagnóstico facial com MediaPipe + Claude AI e envia o protocolo personalizado por e-mail.

## Funcionalidades

- Análise facial em tempo real com Face Mesh (468 pontos)
- Diagnóstico de pele via Claude AI (tipo, oleosidade, acne, sensibilidade)
- Envio automático de protocolo por e-mail (Resend)
- Painel administrativo com gestão de leads e campanhas
- Sistema de webhook configurável para integrações externas
- Links de campanha rastreáveis com slug personalizado

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend + API | Next.js 16 (App Router) |
| Banco de dados | PostgreSQL via Supabase |
| ORM | Prisma 7 |
| IA | Claude Haiku (Anthropic) |
| Visão computacional | MediaPipe Face Mesh |
| Storage | Supabase Storage |
| Email | Resend |
| Auth | JWT (jsonwebtoken) |
| Deploy recomendado | Vercel |

## Configuração

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/jolu-ia.git
cd jolu-ia
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env.local
```

Preencha cada variável no `.env.local` conforme as instruções no arquivo.

### 4. Configure o banco de dados

```bash
npx prisma db push
```

### 5. Inicie o servidor de desenvolvimento

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## Deploy na Vercel

1. Importe o repositório em [vercel.com](https://vercel.com)
2. Adicione todas as variáveis de ambiente do `.env.example`
3. O build já inclui `prisma generate` automaticamente

## Webhook

Após cada análise concluída, o sistema envia um `POST` para a URL configurada no painel admin em **Configurações → Webhook**.

**Payload:**
```json
{
  "event": "lead.analyzed",
  "timestamp": "2026-05-04T11:00:00Z",
  "data": {
    "lead": {
      "nome": "Maria Silva",
      "email": "maria@email.com",
      "telefone": "(11) 99999-9999",
      "desejaMelhorar": "reduzir manchas",
      "campanha": "Instagram Mai/2026"
    },
    "analise": {
      "tipoPele": "Mista",
      "nivelOleosidade": "Media",
      "nivelAcne": "Leve",
      "nivelSensibilidade": "Media",
      "observacoes": "Pele com zona T oleosa...",
      "recomendacoes": [
        { "nome": "Produto", "motivo": "Motivo", "modoDeUso": "Instrução" }
      ]
    }
  }
}
```

**Verificação de assinatura** (opcional): configure `WEBHOOK_SECRET` e cada request incluirá:
```
X-Jolu-Signature: sha256=<hmac-sha256-do-payload>
```

## Rotas da API

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/register` | — | Criar conta admin |
| POST | `/api/auth/login` | — | Login |
| GET | `/api/auth/profile` | JWT | Perfil autenticado |
| GET | `/api/leads/validate-token` | — | Validar link de campanha |
| POST | `/api/leads` | — | Registrar lead |
| POST | `/api/leads/:id/analise` | — | Analisar pele do lead |
| GET | `/api/admin/stats` | JWT | Estatísticas |
| GET | `/api/admin/leads` | JWT | Listar leads |
| GET | `/api/admin/leads/:id` | JWT | Detalhes do lead |
| GET | `/api/admin/tokens` | JWT | Listar campanhas |
| POST | `/api/admin/tokens` | JWT | Criar campanha |
| PATCH | `/api/admin/tokens/:id` | JWT | Ativar/desativar campanha |
| GET | `/api/admin/settings` | JWT | Obter configurações |
| PUT | `/api/admin/settings` | JWT | Salvar configurações |

## Licença

MIT
