const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Configuração do Express e Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const port = 3001;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Variáveis globais
let qrCodeData = null;
let client = null;
let isInitialized = false;

// Função para criar cliente WhatsApp
function createWhatsAppClient() {
    client = new Client({
        puppeteer: {
            headless: false,
            args: ['--no-sandbox']
        },
        authStrategy: new LocalAuth()
    });

    // Eventos do WhatsApp
    client.on('qr', async (qr) => {
        try {
            console.log('QR Code recebido');
            qrCodeData = await qrcode.toDataURL(qr);
            io.emit('qr', qrCodeData);
            io.emit('whatsapp_status', { status: 'QR Code pronto', connected: false });
        } catch (err) {
            console.error('Erro ao gerar QR code:', err);
            io.emit('error', { message: 'Erro ao gerar QR Code' });
        }
    });

    client.on('ready', () => {
        console.log('Cliente WhatsApp está pronto!');
        io.emit('whatsapp_status', { status: 'Conectado', connected: true });
    });

    client.on('authenticated', () => {
        console.log('Autenticado no WhatsApp');
        io.emit('whatsapp_status', { status: 'Autenticado', connected: true });
    });

    client.on('auth_failure', (err) => {
        console.error('Falha na autenticação:', err);
        io.emit('whatsapp_status', { status: 'Falha na autenticação', connected: false });
    });

    client.on('disconnected', (reason) => {
        console.log('WhatsApp desconectado:', reason);
        io.emit('whatsapp_status', { status: 'Desconectado', connected: false });
    });

    return client;
}

// Inicializar cliente WhatsApp
function initializeWhatsApp() {
    if (!client) {
        client = createWhatsAppClient();
    }
    
    if (!isInitialized) {
        isInitialized = true;
        client.initialize().catch(err => {
            console.error('Erro ao inicializar cliente WhatsApp:', err);
            io.emit('error', { message: 'Erro ao inicializar WhatsApp' });
            isInitialized = false;
        });
    }
}

// Eventos do Socket.IO
io.on('connection', (socket) => {
    console.log('Novo cliente conectado');
    
    // Se já tivermos um QR code, envie para o novo cliente
    if (qrCodeData) {
        socket.emit('qr', qrCodeData);
    }

    // Reiniciar WhatsApp
    socket.on('restart', async () => {
        try {
            if (client) {
                await client.destroy();
                client = null;
                isInitialized = false;
            }
            initializeWhatsApp();
            socket.emit('whatsapp_status', { status: 'Reiniciando...', connected: false });
        } catch (error) {
            socket.emit('error', { message: 'Erro ao reiniciar: ' + error.message });
        }
    });

    // Desconectar WhatsApp
    socket.on('disconnect_whatsapp', async () => {
        try {
            if (client) {
                await client.destroy();
                client = null;
                isInitialized = false;
                socket.emit('whatsapp_status', { status: 'Desconectado', connected: false });
            }
        } catch (error) {
            socket.emit('error', { message: 'Erro ao desconectar: ' + error.message });
        }
    });

    // Solicitar novo QR Code
    socket.on('request_qr', () => {
        if (!client || !isInitialized) {
            initializeWhatsApp();
        }
    });

    // Enviar mensagem de teste
    socket.on('send_test', async (data) => {
        if (!client || !client.info) {
            socket.emit('error', { message: 'WhatsApp não está conectado' });
            return;
        }

        try {
            const number = data.number.includes('@c.us') ? data.number : `${data.number}@c.us`;
            await client.sendMessage(number, data.message);
            socket.emit('whatsapp_status', { 
                status: 'Mensagem enviada com sucesso', 
                connected: true 
            });
        } catch (error) {
            socket.emit('error', { message: 'Erro ao enviar mensagem: ' + error.message });
        }
    });
});

// Rotas
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/manage', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        qrReady: !!qrCodeData,
        clientReady: client && !!client.info
    });
});

// Inicialização
console.log('Iniciando servidor...');
server.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log(`Página de gerenciamento em http://localhost:${port}/manage`);
    
    // Inicializar WhatsApp
    initializeWhatsApp();
});
