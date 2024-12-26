const express = require('express');
const session = require('express-session');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const WhatsAppClient = require('./whatsapp/client');
const { initializeSchedulingSystem } = require('./handlers/scheduling');
const { generateToken } = require('./utils/tokenManager');

const prisma = new PrismaClient();
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

// Configuração do Express
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Armazenamento de instâncias
const instances = new Map();

// Middleware de autenticação
const requireAuth = (req, res, next) => {
    if (req.session.authenticated) {
        next();
    } else {
        res.redirect('/login');
    }
};

// Rotas de autenticação
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Simplificado para exemplo - implemente sua própria lógica de autenticação
    if (username === 'admin' && password === 'admin') {
        req.session.authenticated = true;
        res.redirect('/dashboard');
    } else {
        res.render('login', { error: 'Credenciais inválidas' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

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

        const token = generateToken();
        const instanceData = {
            client: null,
            token,
            status: 'initializing'
        };

        instances.set(instanceName, instanceData);

        // Inicializa o cliente do WhatsApp para esta instância
        const client = new WhatsAppClient();
        await client.initialize(instanceName);
        instanceData.client = client;

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
        status: data.status
    }));
    res.json(instancesList);
});

// Rotas públicas
app.get('/manage', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/manage.html'));
});

// Rotas do dashboard
app.get('/dashboard', requireAuth, async (req, res) => {
    const whatsappStatus = WhatsAppClient.isReady ? 'Conectado' : 'Desconectado';
    const professionals = await prisma.professional.findMany();
    const appointments = await prisma.appointment.findMany({
        include: {
            professional: true,
            client: true
        },
        orderBy: {
            date: 'desc'
        },
        take: 10
    });

    res.render('dashboard', {
        whatsappStatus,
        professionals,
        appointments
    });
});

// API de Profissionais
app.get('/api/professionals', requireAuth, async (req, res) => {
    try {
        const professionals = await prisma.professional.findMany();
        res.json(professionals);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar profissionais' });
    }
});

app.post('/api/professionals', requireAuth, async (req, res) => {
    try {
        const professional = await prisma.professional.create({
            data: req.body
        });
        res.json(professional);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao criar profissional' });
    }
});

app.put('/api/professionals/:id', requireAuth, async (req, res) => {
    try {
        const professional = await prisma.professional.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });
        res.json(professional);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar profissional' });
    }
});

app.delete('/api/professionals/:id', requireAuth, async (req, res) => {
    try {
        await prisma.professional.delete({
            where: { id: parseInt(req.params.id) }
        });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao deletar profissional' });
    }
});

// API de Agendamentos
app.get('/api/appointments', requireAuth, async (req, res) => {
    try {
        const appointments = await prisma.appointment.findMany({
            include: {
                professional: true,
                client: true
            }
        });
        res.json(appointments);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar agendamentos' });
    }
});

app.put('/api/appointments/:id', requireAuth, async (req, res) => {
    try {
        const appointment = await prisma.appointment.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
        });
        res.json(appointment);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar agendamento' });
    }
});

// Socket.IO para atualizações em tempo real
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
                instance.client = new WhatsAppClient();
                await instance.client.initialize(instanceName);
                socket.emit(`whatsapp_status_${instanceName}`, { status: 'initializing' });
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
                socket.emit(`whatsapp_status_${instanceName}`, { status: 'disconnected' });
            } catch (error) {
                socket.emit(`error_${instanceName}`, { message: 'Erro ao desconectar: ' + error.message });
            }
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
            socket.emit(`whatsapp_status_${instanceName}`, { status: 'message_sent' });
        } catch (error) {
            socket.emit(`error_${instanceName}`, { message: 'Erro ao enviar mensagem: ' + error.message });
        }
    });

    // Eventos do WhatsApp
    if (WhatsAppClient.client) {
        if (WhatsAppClient.isReady) {
            socket.emit('whatsapp:status', { status: 'connected' });
        }

        WhatsAppClient.client.on('qr', (qr) => {
            socket.emit('whatsapp:qr', qr);
        });

        WhatsAppClient.client.on('ready', () => {
            socket.emit('whatsapp:status', { status: 'connected' });
        });

        WhatsAppClient.client.on('disconnected', () => {
            socket.emit('whatsapp:status', { status: 'disconnected' });
        });
    }
});

// Inicialização
async function startServer() {
    try {
        // Inicializa o WhatsApp
        await WhatsAppClient.initialize();
        if (typeof initializeSchedulingSystem === 'function') {
            initializeSchedulingSystem();
        }

        // Inicia o servidor
        const PORT = process.env.PORT || 3001;
        server.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
            console.log(`Página de gerenciamento em http://localhost:${PORT}/manage`);
        });
    } catch (error) {
        console.error('Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

module.exports = { startServer };
