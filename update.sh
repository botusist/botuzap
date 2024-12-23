#!/bin/bash

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Atualizador BotUzap ===${NC}"

# Verificar se está no diretório correto
if [ ! -f "package.json" ]; then
    echo -e "${RED}Erro: Execute este script dentro do diretório botuzap${NC}"
    exit 1
fi

echo -e "\n${YELLOW}Parando aplicação...${NC}"
pm2 stop botuzap

echo -e "\n${YELLOW}Atualizando código...${NC}"
git pull

echo -e "\n${YELLOW}Instalando dependências...${NC}"
npm install

echo -e "\n${YELLOW}Reiniciando aplicação...${NC}"
pm2 restart botuzap

echo -e "\n${GREEN}Atualização concluída!${NC}"
echo -e "Use ${YELLOW}pm2 logs botuzap${NC} para ver os logs"
