# BotUzap - Sistema de Gerenciamento WhatsApp

Sistema de gerenciamento de instâncias WhatsApp usando whatsapp-web.js.

## Requisitos do Sistema

- Node.js 18.x ou superior
- NPM 8.x ou superior
- Google Chrome ou Chromium
- PM2 (para gerenciamento de processos)

## Instalação em VPS (Ubuntu/Debian)

### 1. Atualizar o sistema
```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Instalar Node.js 18.x
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. Instalar dependências do sistema
```bash
sudo apt install -y gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget build-essential
```

### 4. Instalar Google Chrome
```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt --fix-broken install -y
```

### 5. Instalar PM2 globalmente
```bash
sudo npm install -g pm2
```

### 6. Configurar o projeto

1. Clone o repositório ou faça upload dos arquivos
```bash
git clone [seu-repositorio] botuzap
cd botuzap
```

2. Instale as dependências
```bash
npm install
```

3. Inicie o projeto com PM2
```bash
pm2 start ecosystem.config.js
```

4. Configure o PM2 para iniciar com o sistema
```bash
pm2 startup
pm2 save
```

## Configuração de Firewall (se necessário)

Se você estiver usando UFW:
```bash
sudo ufw allow 3001
```

## Configuração de Proxy Reverso (Nginx)

Instale o Nginx:
```bash
sudo apt install nginx -y
```

Crie uma configuração para o seu domínio:
```bash
sudo nano /etc/nginx/sites-available/botuzap
```

Adicione a seguinte configuração:
```nginx
server {
    listen 80;
    server_name seu-dominio.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ative a configuração:
```bash
sudo ln -s /etc/nginx/sites-available/botuzap /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Monitoramento

- Verificar logs: `pm2 logs`
- Status do processo: `pm2 status`
- Monitoramento em tempo real: `pm2 monit`
- Reiniciar aplicação: `pm2 restart botuzap`

## Atualizações

Para atualizar o sistema:

1. Pare o processo
```bash
pm2 stop botuzap
```

2. Atualize os arquivos

3. Reinstale as dependências
```bash
npm install
```

4. Reinicie o processo
```bash
pm2 restart botuzap
```

## Solução de Problemas

### Se o Chrome não iniciar:
1. Verifique se o Chrome está instalado:
```bash
google-chrome --version
```

2. Verifique os logs:
```bash
pm2 logs botuzap
```

### Se o QR Code não aparecer:
1. Verifique se todas as dependências do sistema estão instaladas
2. Tente reiniciar o processo:
```bash
pm2 restart botuzap
```

### Problemas de memória:
1. Verifique o uso de memória:
```bash
pm2 monit
```

2. Se necessário, ajuste os limites de memória no ecosystem.config.js
