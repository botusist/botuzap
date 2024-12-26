require('dotenv').config();
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const { generateToken } = require('./utils/tokenManager');

// Configuração do Express e Socket.IO
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const port = 3333;

// Middleware para logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

// Middleware
app.use(express.json());

// Servir arquivos estáticos do diretório public
app.use(express.static(path.join(__dirname, '../public')));

// Servir manage.html da raiz do projeto
app.get('/manage', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/manage.html'), (err) => {
        if (err) {
            console.error('Erro ao servir manage.html:', err);
            res.status(500).send('Erro ao carregar a página');
        } else {
            console.log('manage.html servido com sucesso');
        }
    });
});

// Rota raiz
app.get('/', (req, res) => {
    const indexPath = path.join(__dirname, '../public/index.html');
    console.log('Tentando servir:', indexPath);
    res.sendFile(indexPath);
});

// Variáveis globais
const instances = new Map();

// Rotas da API
app.post('/api/instance/create', async (req, res) => {
    try {
        const { instanceName } = req.body;
        
        if (!instanceName) {
            return res.status(400).json({ error: 'Nome da instância é obrigatório' });
        }

        if (instances.has(instanceName)) {
            return res.status(400).json({ error: 'Instância já existe' });
        }

        // Criar nova instância do WhatsApp
        const client = new Client({
            authStrategy: new LocalAuth({ clientId: instanceName }),
            puppeteer: {
                args: ['--no-sandbox']
            }
        });

        const token = generateToken();
        const instanceData = {
            client,
            token,
            qrCode: null,
            status: 'initializing',
            isInitialized: false
        };

        instances.set(instanceName, instanceData);

        // Configurar eventos do cliente
        client.on('qr', async (qr) => {
            try {
                console.log(`QR Code recebido para instância ${instanceName}`);
                instanceData.qrCode = await qrcode.toDataURL(qr);
                io.emit(`qr_${instanceName}`, instanceData.qrCode);
                io.emit(`whatsapp_status_${instanceName}`, { status: 'QR Code pronto', connected: false });
            } catch (err) {
                console.error(`Erro ao gerar QR code para ${instanceName}:`, err);
                io.emit(`error_${instanceName}`, { message: 'Erro ao gerar QR Code' });
            }
        });

        client.on('ready', () => {
            console.log(`Cliente WhatsApp ${instanceName} está pronto!`);
            instanceData.status = 'connected';
            io.emit(`whatsapp_status_${instanceName}`, { status: 'Conectado', connected: true });
        });

        client.on('authenticated', () => {
            console.log(`${instanceName} autenticado no WhatsApp`);
            instanceData.status = 'authenticated';
            io.emit(`whatsapp_status_${instanceName}`, { status: 'Autenticado', connected: true });
        });

        client.on('auth_failure', (err) => {
            console.error(`Falha na autenticação ${instanceName}:`, err);
            instanceData.status = 'auth_failure';
            io.emit(`whatsapp_status_${instanceName}`, { status: 'Falha na autenticação', connected: false });
        });

        client.on('disconnected', (reason) => {
            console.log(`WhatsApp ${instanceName} desconectado:`, reason);
            instanceData.status = 'disconnected';
            io.emit(`whatsapp_status_${instanceName}`, { status: 'Desconectado', connected: false });
        });

        // Inicializar cliente
        client.initialize().catch(err => {
            console.error(`Erro ao inicializar cliente WhatsApp ${instanceName}:`, err);
            io.emit(`error_${instanceName}`, { message: 'Erro ao inicializar WhatsApp' });
        });

        res.json({
            instanceName,
            token,
            status: 'initializing'
        });
    } catch (error) {
        console.error('Erro ao criar instância:', error);
        res.status(500).json({ error: 'Erro ao criar instância' });
    }
});

app.get('/api/instances', (req, res) => {
    const instancesList = Array.from(instances.entries()).map(([name, data]) => ({
        instanceName: name,
        status: data.status,
        connected: data.status === 'connected'
    }));
    res.json(instancesList);
});

// Eventos do Socket.IO
io.on('connection', (socket) => {
    console.log('Cliente conectado ao Socket.IO');

    socket.on('disconnect', () => {
        console.log('Cliente desconectado do Socket.IO');
    });

    socket.on('restart', async (instanceName) => {
        const instance = instances.get(instanceName);
        if (instance) {
            try {
                if (instance.client) {
                    await instance.client.destroy();
                }
                
                const client = new Client({
                    authStrategy: new LocalAuth({ clientId: instanceName }),
                    puppeteer: {
                        args: ['--no-sandbox']
                    }
                });

                instance.client = client;
                instance.status = 'initializing';

                // Reconfigurar eventos
                client.on('qr', async (qr) => {
                    try {
                        instance.qrCode = await qrcode.toDataURL(qr);
                        socket.emit(`qr_${instanceName}`, instance.qrCode);
                    } catch (err) {
                        socket.emit(`error_${instanceName}`, { message: 'Erro ao gerar QR Code' });
                    }
                });

                client.on('ready', () => {
                    instance.status = 'connected';
                    socket.emit(`whatsapp_status_${instanceName}`, { status: 'Conectado', connected: true });
                });

                await client.initialize();
                socket.emit(`whatsapp_status_${instanceName}`, { status: 'Reiniciando...', connected: false });
            } catch (error) {
                socket.emit(`error_${instanceName}`, { message: 'Erro ao reiniciar: ' + error.message });
            }
        }
    });

    socket.on('disconnect_whatsapp', async (instanceName) => {
        const instance = instances.get(instanceName);
        if (instance && instance.client) {
            try {
                await instance.client.destroy();
                instance.status = 'disconnected';
                socket.emit(`whatsapp_status_${instanceName}`, { status: 'Desconectado', connected: false });
            } catch (error) {
                socket.emit(`error_${instanceName}`, { message: 'Erro ao desconectar: ' + error.message });
            }
        }
    });

    socket.on('request_qr', async (instanceName) => {
        const instance = instances.get(instanceName);
        if (instance && instance.qrCode) {
            socket.emit(`qr_${instanceName}`, instance.qrCode);
        }
    });

    socket.on('send_test', async (instanceName, data) => {
        const instance = instances.get(instanceName);
        if (!instance || !instance.client) {
            socket.emit(`error_${instanceName}`, { message: 'Instância não encontrada ou não inicializada' });
            return;
        }

        try {
            const number = data.number.includes('@c.us') ? data.number : `${data.number}@c.us`;
            await instance.client.sendMessage(number, data.message);
            socket.emit(`whatsapp_status_${instanceName}`, { status: 'Mensagem enviada', connected: true });
        } catch (error) {
            socket.emit(`error_${instanceName}`, { message: 'Erro ao enviar mensagem: ' + error.message });
        }
    });
});

// Inicialização do servidor
server.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
    console.log(`Página de gerenciamento em http://localhost:${port}/manage`);
});
