# BotUzap - Sistema de WhatsApp Multi-Instância

Sistema para gerenciamento de múltiplas instâncias do WhatsApp com interface web.

## Funcionalidades

- ✨ Gerenciamento de múltiplas instâncias do WhatsApp
- 🔒 Autenticação por token para cada instância
- 🌐 Interface web para gerenciamento
- 📱 QR Code para conexão com WhatsApp
- 🔄 Reconexão automática
- 📨 API para envio de mensagens

## Requisitos do Sistema

- Node.js 18.x ou superior
- Linux (Ubuntu/Debian) para instalação automática
- Google Chrome

## Instalação Rápida (Ubuntu/Debian)

```bash
# 1. Baixe o script de instalação
wget https://raw.githubusercontent.com/botusist/botuzap/main/install.sh

# 2. Dê permissão de execução
chmod +x install.sh

# 3. Execute o instalador
sudo ./install.sh
```

O instalador irá:
- Instalar todas as dependências necessárias
- Configurar o Node.js e PM2
- Clonar o repositório
- Iniciar o serviço automaticamente

## Instalação Manual

1. Clone o repositório:
```bash
git clone https://github.com/botusist/botuzap.git
cd botuzap
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o ambiente:
```bash
cp .env.example .env
```

4. Inicie o servidor:
```bash
npm start
```

## Uso

1. Acesse a interface de gerenciamento:
```
http://seu-ip:3333/manage
```

2. Digite um nome para sua instância e clique em "Criar Instância"

3. Escaneie o QR Code com seu WhatsApp

4. Pronto! A instância está conectada e pronta para uso

## API

### Criar Instância
```http
POST /instance/create
Content-Type: application/json

{
  "name": "nome-da-instancia"
}
```

### Enviar Mensagem
```http
POST /message/send
Content-Type: application/json
Authorization: Bearer seu-token-aqui

{
  "number": "5511999999999",
  "message": "Sua mensagem aqui"
}
```

## Comandos PM2

- Ver logs: `pm2 logs botuzap`
- Status: `pm2 status`
- Reiniciar: `pm2 restart botuzap`
- Parar: `pm2 stop botuzap`

## Suporte

Para suporte, abra uma issue no GitHub.

## Licença

MIT
