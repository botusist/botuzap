const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

class WhatsAppClient {
    constructor() {
        this.client = null;
        this.isReady = false;
        this.messageHandlers = new Map();
        this.status = 'initializing';
        this.qrCode = null;
    }

    async initialize(instanceName) {
        // Configuração do cliente WhatsApp
        this.client = new Client({
            authStrategy: new LocalAuth({ clientId: instanceName }),
            puppeteer: {
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });

        // Evento de QR Code
        this.client.on('qr', (qr) => {
            console.log(`QR Code recebido para instância ${instanceName}`);
            this.qrCode = qr;
            this.status = 'qr_ready';
            qrcode.generate(qr, { small: true });
        });

        // Evento de pronto
        this.client.on('ready', () => {
            console.log(`Cliente WhatsApp ${instanceName} está pronto!`);
            this.isReady = true;
            this.status = 'connected';
        });

        // Evento de autenticação bem sucedida
        this.client.on('authenticated', () => {
            console.log(`Cliente ${instanceName} autenticado com sucesso!`);
            this.status = 'authenticated';
        });

        // Evento de desconexão
        this.client.on('disconnected', (reason) => {
            console.log(`Cliente ${instanceName} desconectado:`, reason);
            this.isReady = false;
            this.status = 'disconnected';
        });

        // Manipulador de mensagens
        this.client.on('message', async (message) => {
            try {
                // Processa diferentes tipos de mensagem
                if (message.hasMedia) {
                    const media = await message.downloadMedia();
                    await this.handleMediaMessage(message, media);
                } else {
                    await this.handleTextMessage(message);
                }
            } catch (error) {
                console.error('Erro ao processar mensagem:', error);
                await message.reply('Desculpe, ocorreu um erro ao processar sua mensagem.');
            }
        });

        // Inicializa o cliente
        await this.client.initialize();
    }

    async destroy() {
        if (this.client) {
            await this.client.destroy();
            this.client = null;
            this.isReady = false;
            this.status = 'destroyed';
        }
    }

    async sendMessage(to, message) {
        if (!this.client || !this.isReady) {
            throw new Error('Cliente não está pronto');
        }
        return await this.client.sendMessage(to, message);
    }

    // Registra um manipulador de mensagens
    onMessage(handler) {
        const handlerId = Date.now().toString();
        this.messageHandlers.set(handlerId, handler);
        return handlerId;
    }

    // Remove um manipulador de mensagens
    removeMessageHandler(handlerId) {
        this.messageHandlers.delete(handlerId);
    }

    // Processa mensagens de texto
    async handleTextMessage(message) {
        for (const handler of this.messageHandlers.values()) {
            await handler({
                type: 'text',
                content: message.body,
                from: message.from,
                timestamp: message.timestamp,
                message: message
            });
        }
    }

    // Processa mensagens de mídia
    async handleMediaMessage(message, media) {
        const mediaType = {
            'image/jpeg': 'image',
            'image/png': 'image',
            'image/gif': 'image',
            'audio/ogg': 'audio',
            'audio/mpeg': 'audio',
            'video/mp4': 'video'
        }[media.mimetype] || 'document';

        // Salva o arquivo de mídia
        const extension = media.mimetype.split('/')[1];
        const filename = `${Date.now()}.${extension}`;
        const mediaPath = path.join(__dirname, '..', 'media', filename);
        
        // Garante que o diretório existe
        fs.mkdirSync(path.join(__dirname, '..', 'media'), { recursive: true });
        
        // Salva o arquivo
        fs.writeFileSync(mediaPath, Buffer.from(media.data, 'base64'));

        for (const handler of this.messageHandlers.values()) {
            await handler({
                type: mediaType,
                content: mediaPath,
                mimetype: media.mimetype,
                filename: media.filename,
                from: message.from,
                timestamp: message.timestamp,
                message: message
            });
        }
    }

    getStatus() {
        return {
            isReady: this.isReady,
            status: this.status,
            qrCode: this.qrCode
        };
    }
}

module.exports = WhatsAppClient;
