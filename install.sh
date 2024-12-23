#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Instalador BotUzap ===${NC}"
echo -e "${YELLOW}Este script instalará todas as dependências necessárias para o BotUzap${NC}\n"

# Função para verificar o último comando
check_command() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
    else
        echo -e "${RED}✗ Erro: $1${NC}"
        exit 1
    fi
}

# Verificar se está rodando como root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Por favor, execute este script como root (use sudo)${NC}"
    exit 1
fi

echo -e "${YELLOW}Atualizando sistema...${NC}"
apt update
check_command "Atualização do sistema"
apt upgrade -y
check_command "Upgrade do sistema"

echo -e "\n${YELLOW}Instalando curl e wget...${NC}"
apt install -y curl wget
check_command "Instalação do curl e wget"

echo -e "\n${YELLOW}Instalando Node.js 18.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
check_command "Configuração do Node.js"
apt install -y nodejs
check_command "Instalação do Node.js"

echo -e "\n${YELLOW}Instalando dependências do sistema...${NC}"
apt install -y gconf-service libgbm-dev libasound2 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 \
    libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 \
    libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 \
    libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 libxss1 libxtst6 \
    ca-certificates fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils wget build-essential
check_command "Instalação das dependências do sistema"

echo -e "\n${YELLOW}Instalando Google Chrome...${NC}"
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
dpkg -i google-chrome-stable_current_amd64.deb
apt --fix-broken install -y
check_command "Instalação do Google Chrome"
rm google-chrome-stable_current_amd64.deb

echo -e "\n${YELLOW}Instalando PM2...${NC}"
npm install -g pm2
check_command "Instalação do PM2"

# Verificar se o diretório botuzap já existe
if [ -d "botuzap" ]; then
    echo -e "\n${YELLOW}Diretório botuzap encontrado. Atualizando...${NC}"
    cd botuzap
    git pull
    check_command "Atualização do código"
else
    echo -e "\n${YELLOW}Clonando repositório...${NC}"
    git clone https://github.com/botusist/botuzap.git
    check_command "Clone do repositório"
    cd botuzap
fi

echo -e "\n${YELLOW}Instalando dependências do Node.js...${NC}"
npm install
check_command "Instalação das dependências do Node.js"

echo -e "\n${YELLOW}Configurando PM2...${NC}"
pm2 start ecosystem.config.js
check_command "Início do aplicativo"

echo -e "\n${YELLOW}Configurando inicialização automática...${NC}"
pm2 startup
pm2 save
check_command "Configuração da inicialização automática"

# Obter IP público
PUBLIC_IP=$(curl -s ifconfig.me)

echo -e "\n${GREEN}=== Instalação Concluída! ===${NC}"
echo -e "Acesse:"
echo -e "${GREEN}QR Code: http://$PUBLIC_IP:3001${NC}"
echo -e "${GREEN}Gerenciamento: http://$PUBLIC_IP:3001/manage${NC}"

echo -e "\n${YELLOW}Comandos úteis:${NC}"
echo -e "- Ver logs: ${GREEN}pm2 logs botuzap${NC}"
echo -e "- Status: ${GREEN}pm2 status${NC}"
echo -e "- Reiniciar: ${GREEN}pm2 restart botuzap${NC}"
echo -e "- Parar: ${GREEN}pm2 stop botuzap${NC}"
