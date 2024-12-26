// Conectar ao Socket.IO
const socket = io();

// Elementos do DOM
const openaiForm = document.getElementById('openai-form');
const generalSettingsForm = document.getElementById('general-settings-form');
const whatsappStatus = document.getElementById('status-text');
const qrcodeContainer = document.getElementById('qrcode-container');
const qrcodeImage = document.getElementById('qrcode');

// Carregar configurações salvas
document.addEventListener('DOMContentLoaded', () => {
    loadOpenAISettings();
    loadGeneralSettings();
    loadWhatsAppStatus();
});

// Funções para OpenAI
async function loadOpenAISettings() {
    try {
        const response = await fetch('/api/admin/settings/openai');
        const settings = await response.json();
        
        if (settings) {
            document.getElementById('api-key').value = settings.apiKey || '';
            document.getElementById('model').value = settings.model || 'gpt-3.5-turbo';
            document.getElementById('prompt').value = settings.prompt || '';
            document.getElementById('temperature').value = settings.temperature || 0.7;
        }
    } catch (error) {
        console.error('Erro ao carregar configurações OpenAI:', error);
        showMessage('Erro ao carregar configurações OpenAI', 'error');
    }
}

openaiForm.onsubmit = async (event) => {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        apiKey: formData.get('apiKey'),
        model: formData.get('model'),
        prompt: formData.get('prompt'),
        temperature: parseFloat(formData.get('temperature'))
    };

    try {
        const response = await fetch('/api/admin/settings/openai', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Erro ao salvar configurações OpenAI');
        }

        showMessage('Configurações OpenAI salvas com sucesso', 'success');
    } catch (error) {
        showMessage(error.message, 'error');
    }
};

// Funções para Configurações Gerais
async function loadGeneralSettings() {
    try {
        const response = await fetch('/api/admin/settings/general');
        const settings = await response.json();
        
        if (settings) {
            document.getElementById('business-name').value = settings.businessName || '';
            document.getElementById('opening-time').value = settings.openingTime || '09:00';
            document.getElementById('closing-time').value = settings.closingTime || '18:00';
            
            // Marcar dias de funcionamento
            const workDays = settings.workDays || [1,2,3,4,5];
            workDays.forEach(day => {
                const checkbox = document.querySelector(`input[name="workDays"][value="${day}"]`);
                if (checkbox) checkbox.checked = true;
            });
        }
    } catch (error) {
        console.error('Erro ao carregar configurações gerais:', error);
        showMessage('Erro ao carregar configurações gerais', 'error');
    }
}

generalSettingsForm.onsubmit = async (event) => {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const workDays = Array.from(formData.getAll('workDays')).map(Number);
    
    const data = {
        businessName: formData.get('businessName'),
        openingTime: formData.get('openingTime'),
        closingTime: formData.get('closingTime'),
        workDays
    };

    try {
        const response = await fetch('/api/admin/settings/general', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Erro ao salvar configurações gerais');
        }

        showMessage('Configurações gerais salvas com sucesso', 'success');
    } catch (error) {
        showMessage(error.message, 'error');
    }
};

// Funções para WhatsApp
function loadWhatsAppStatus() {
    socket.emit('whatsapp:status');
}

socket.on('whatsapp:status', (status) => {
    whatsappStatus.textContent = status;
    whatsappStatus.className = status === 'Conectado' ? 'text-green-600' : 'text-red-600';
});

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

function reconnectWhatsApp() {
    socket.emit('whatsapp:reconnect');
    whatsappStatus.textContent = 'Reconectando...';
    whatsappStatus.className = 'text-yellow-600';
}

// Funções para Backup e Restauração
async function generateBackup() {
    try {
        const response = await fetch('/api/admin/backup');
        const blob = await response.blob();
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        showMessage('Backup gerado com sucesso', 'success');
    } catch (error) {
        showMessage('Erro ao gerar backup', 'error');
    }
}

async function restoreBackup() {
    const fileInput = document.getElementById('restore-file');
    const file = fileInput.files[0];
    
    if (!file) {
        showMessage('Selecione um arquivo de backup', 'warning');
        return;
    }

    const formData = new FormData();
    formData.append('backup', file);

    try {
        const response = await fetch('/api/admin/restore', {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Erro ao restaurar backup');
        }

        showMessage('Backup restaurado com sucesso', 'success');
        setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// Função para mostrar mensagens
function showMessage(message, type = 'info') {
    const statusMessage = document.createElement('div');
    statusMessage.className = `fixed top-4 right-4 p-4 rounded shadow-lg ${getMessageClass(type)}`;
    statusMessage.textContent = message;
    
    document.body.appendChild(statusMessage);
    
    setTimeout(() => {
        statusMessage.remove();
    }, 3000);
}

function getMessageClass(type) {
    const classes = {
        'success': 'bg-green-500 text-white',
        'error': 'bg-red-500 text-white',
        'info': 'bg-blue-500 text-white',
        'warning': 'bg-yellow-500 text-white'
    };
    return classes[type] || classes.info;
}
