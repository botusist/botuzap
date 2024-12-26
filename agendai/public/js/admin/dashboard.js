// Conectar ao Socket.IO
const socket = io();

// Elementos do DOM
const professionalsCount = document.getElementById('professionals-count');
const appointmentsCount = document.getElementById('appointments-count');
const clientsCount = document.getElementById('clients-count');
const completionRate = document.getElementById('completion-rate');
const recentAppointments = document.getElementById('recent-appointments');
const whatsappStatus = document.getElementById('whatsapp-status');
const openaiStatus = document.getElementById('openai-status');
const databaseStatus = document.getElementById('database-status');

// Carregar dados iniciais
document.addEventListener('DOMContentLoaded', () => {
    loadDashboardData();
    loadSystemStatus();
});

// Função para carregar dados do dashboard
async function loadDashboardData() {
    try {
        const response = await fetch('/api/admin/dashboard');
        const data = await response.json();
        
        // Atualizar contadores
        professionalsCount.textContent = data.professionals;
        appointmentsCount.textContent = data.todayAppointments;
        clientsCount.textContent = data.clients;
        completionRate.textContent = `${data.completionRate}%`;

        // Atualizar tabela de agendamentos recentes
        recentAppointments.innerHTML = data.recentAppointments.map(appointment => `
            <tr class="border-b">
                <td class="py-2">${appointment.client_name}</td>
                <td class="py-2">${appointment.professional_name}</td>
                <td class="py-2">${formatDate(appointment.date)} ${appointment.time}</td>
                <td class="py-2">
                    <span class="px-2 py-1 rounded text-sm ${getStatusClass(appointment.status)}">
                        ${appointment.status}
                    </span>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        showMessage('Erro ao carregar dados do dashboard', 'error');
    }
}

// Função para carregar status do sistema
async function loadSystemStatus() {
    try {
        const response = await fetch('/api/admin/system-status');
        const status = await response.json();
        
        // Atualizar status do WhatsApp
        updateStatus(whatsappStatus, status.whatsapp);
        
        // Atualizar status da OpenAI
        updateStatus(openaiStatus, status.openai);
        
        // Atualizar status do banco de dados
        updateStatus(databaseStatus, status.database);
    } catch (error) {
        console.error('Erro ao carregar status do sistema:', error);
    }
}

// Eventos do Socket.IO
socket.on('whatsapp:status', (status) => {
    updateStatus(whatsappStatus, status);
});

socket.on('dashboard:update', () => {
    loadDashboardData();
});

// Funções auxiliares
function updateStatus(element, status) {
    element.textContent = status.message;
    element.className = `px-2 py-1 rounded text-sm ${getStatusClass(status.state)}`;
}

function getStatusClass(status) {
    const classes = {
        'connected': 'bg-green-100 text-green-800',
        'disconnected': 'bg-red-100 text-red-800',
        'pending': 'bg-yellow-100 text-yellow-800',
        'error': 'bg-red-100 text-red-800',
        'success': 'bg-green-100 text-green-800'
    };
    return classes[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

// Função para fazer logout
function handleLogout() {
    fetch('/api/admin/logout', { method: 'POST' })
        .then(() => {
            window.location.href = '/admin/login.html';
        })
        .catch(error => {
            console.error('Erro ao fazer logout:', error);
            showMessage('Erro ao fazer logout', 'error');
        });
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
