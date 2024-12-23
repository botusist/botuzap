# BotUzap - Sistema de Gerenciamento WhatsApp

Sistema de gerenciamento de instâncias WhatsApp usando whatsapp-web.js.

## Instalação Rápida (Ubuntu/Debian)

1. Baixe o script de instalação:
```bash
wget https://raw.githubusercontent.com/botusist/botuzap/main/install.sh
```

2. Dê permissão de execução:
```bash
chmod +x install.sh
```

3. Execute o instalador:
```bash
sudo ./install.sh
```

O script fará automaticamente:
- Atualização do sistema
- Instalação do Node.js 18.x
- Instalação das dependências do sistema
- Instalação do Google Chrome
- Instalação do PM2
- Clone do repositório
- Configuração do ambiente
- Inicialização do serviço

## Atualizações

Para atualizar o sistema:

```bash
cd botuzap
chmod +x update.sh
./update.sh
```

## Acesso

Após a instalação, acesse:
- QR Code: `http://seu-ip:3001`
- Gerenciamento: `http://seu-ip:3001/manage`

## Comandos Úteis

- Ver logs: `pm2 logs botuzap`
- Status: `pm2 status`
- Reiniciar: `pm2 restart botuzap`
- Parar: `pm2 stop botuzap`

## Instalação Manual

Se preferir fazer a instalação manual, siga estas etapas:

### 1. Requisitos do Sistema

- Node.js 18.x ou superior
- NPM 8.x ou superior
- Google Chrome ou Chromium
- PM2 (para gerenciamento de processos)

### 2. Instalação em VPS (Ubuntu/Debian)

```bash
# Atualizar sistema
sudo apt update
sudo apt upgrade -y

# Instalar Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Instalar dependências do sistema
sudo apt install -y gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget build-essential

# Instalar Chrome
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt --fix-broken install -y

# Instalar PM2
sudo npm install -g pm2
```

### 3. Configurar o Projeto

```bash
# Clonar repositório
git clone https://github.com/botusist/botuzap.git
cd botuzap

# Instalar dependências
npm install

# Iniciar com PM2
pm2 start ecosystem.config.js

# Configurar para iniciar com o sistema
pm2 startup
pm2 save
```

## Configuração de Proxy Reverso (Nginx)

Se você quiser usar um domínio e HTTPS:

```bash
# Instalar Nginx
sudo apt install nginx -y

# Criar configuração
sudo nano /etc/nginx/sites-available/botuzap
```

Adicione a configuração:
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
