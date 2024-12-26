// Conectar ao Socket.IO
const socket = io();

// Elementos do DOM
const openaiForm = document.getElementById('openai-form');
const whatsappStatus = document.getElementById('status-text');
const qrcodeContainer = document.getElementById('qrcode-container');
const qrcodeImage = document.getElementById('qrcode');

// Carregar configurações salvas
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/settings');
        const settings = await response.json();
        
        if (settings.openai) {
            document.getElementById('api-key').value = settings.openai.apiKey || '';
            document.getElementById('model').value = settings.openai.model || 'gpt-3.5-turbo';
            document.getElementById('prompt').value = settings.openai.prompt || '';
            document.getElementById('temperature').value = settings.openai.temperature || 0.7;
        }
    } catch (error) {
        console.error('Erro ao carregar configurações:', error);
    }
});

// Salvar configurações
openaiForm.onsubmit = async (event) => {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        openai: {
            apiKey: formData.get('apiKey'),
            model: formData.get('model'),
            prompt: formData.get('prompt'),
            temperature: parseFloat(formData.get('temperature'))
        }
    };

    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Erro ao salvar configurações');
        }

        showMessage('Configurações salvas com sucesso!', 'success');
    } catch (error) {
        showMessage(error.message, 'error');
    }
};

// Eventos do Socket.IO para WhatsApp
socket.on('whatsapp:qr', (qr) => {
    qrcodeContainer.classList.remove('hidden');
    qrcodeImage.src = qr;
    whatsappStatus.textContent = 'Aguardando conexão...';
    whatsappStatus.className = 'text-yellow-600';
});

socket.on('whatsapp:ready', () => {
    qrcodeContainer.classList.add('hidden');
    whatsappStatus.textContent = 'Conectado';
    whatsappStatus.className = 'text-green-600';
});

socket.on('whatsapp:disconnected', () => {
    whatsappStatus.textContent = 'Desconectado';
    whatsappStatus.className = 'text-red-600';
});

// Função para reconectar WhatsApp
function reconnectWhatsApp() {
    socket.emit('whatsapp:reconnect');
    whatsappStatus.textContent = 'Reconectando...';
    whatsappStatus.className = 'text-yellow-600';
}

// Função para mostrar mensagens
function showMessage(message, type = 'info') {
    const statusMessage = document.createElement('div');
    statusMessage.className = `fixed top-4 right-4 p-4 rounded shadow-lg status-message status-${type} fade-in`;
    statusMessage.textContent = message;
    
    document.body.appendChild(statusMessage);
    
    setTimeout(() => {
        statusMessage.remove();
    }, 3000);
}
