// Conexão com Socket.IO
const socket = io();

// Elementos do DOM
const qrcodeContainer = document.getElementById('qrcode-container');
const qrcodeImage = document.getElementById('qrcode');
const whatsappStatus = document.getElementById('whatsapp-status');

// Eventos do Socket.IO
socket.on('connect', () => {
    console.log('Conectado ao servidor');
});

socket.on('whatsapp:qr', (qrCode) => {
    qrcodeContainer.classList.remove('hidden');
    qrcodeImage.src = qrCode;
    whatsappStatus.textContent = 'Escaneie o QR Code com seu WhatsApp';
});

socket.on('whatsapp:ready', () => {
    qrcodeContainer.classList.add('hidden');
    whatsappStatus.textContent = 'WhatsApp conectado!';
    whatsappStatus.classList.add('text-green-600');
});

// Funções auxiliares
function showMessage(message, type = 'info') {
    const statusMessage = document.createElement('div');
    statusMessage.className = `status-message status-${type} fade-in`;
    statusMessage.textContent = message;
    
    document.body.appendChild(statusMessage);
    
    setTimeout(() => {
        statusMessage.remove();
    }, 3000);
}

// Função para formatar data
function formatDate(date) {
    return new Date(date).toLocaleDateString('pt-BR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Função para formatar hora
function formatTime(time) {
    return time.slice(0, 5); // Assume formato HH:mm
}
