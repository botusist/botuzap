// Elementos do DOM
const clientsList = document.getElementById('clients-list');
const clientModal = document.getElementById('client-modal');
const clientForm = document.getElementById('client-form');
const modalTitle = document.getElementById('modal-title');
const searchInput = document.getElementById('search');
const statusFilter = document.getElementById('status-filter');

// Verificar se o admin está logado
function checkAuth() {
    const admin = localStorage.getItem('admin');
    if (!admin) {
        window.location.href = '/admin/login.html';
        return false;
    }
    return true;
}

// Carregar lista de clientes
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    loadClients();
});

// Carregar clientes com filtros
async function loadClients() {
    try {
        let url = '/api/admin/clients';
        const filters = [];
        
        if (searchInput.value) {
            filters.push(`search=${encodeURIComponent(searchInput.value)}`);
        }
        if (statusFilter.value) {
            filters.push(`status=${statusFilter.value}`);
        }
        
        if (filters.length > 0) {
            url += '?' + filters.join('&');
        }
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error('Erro ao buscar clientes');
        }
        
        const clients = await response.json();
        
        if (clients.length === 0) {
            clientsList.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                        Nenhum cliente encontrado
                    </td>
                </tr>
            `;
            return;
        }
        
        clientsList.innerHTML = clients.map(client => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${client.name}</div>
                    <div class="text-sm text-gray-500">${client.email || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${client.phone}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                        ${client.last_appointment ? formatDateTime(client.last_appointment) : 'Nunca'}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(client.status)}">
                        ${getStatusText(client.status)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="editClient(${client.id})" class="text-indigo-600 hover:text-indigo-900 mr-4">
                        Editar
                    </button>
                    <button onclick="viewAppointments(${client.id})" class="text-indigo-600 hover:text-indigo-900">
                        Agendamentos
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar clientes:', error);
        showMessage(error.message, 'error');
        clientsList.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-red-500">
                    Erro ao carregar clientes. Por favor, tente novamente.
                </td>
            </tr>
        `;
    }
}

// Função para aplicar filtros
function applyFilters() {
    loadClients();
}

// Funções do Modal
async function editClient(id) {
    if (!checkAuth()) return;
    try {
        const response = await fetch(`/api/admin/clients/${id}`, {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error('Erro ao buscar dados do cliente');
        }
        
        const client = await response.json();
        
        modalTitle.textContent = 'Editar Cliente';
        clientForm.elements.name.value = client.name;
        clientForm.elements.phone.value = client.phone;
        clientForm.elements.email.value = client.email || '';
        clientForm.elements.status.value = client.status;
        clientForm.elements.notes.value = client.notes || '';
        clientForm.dataset.id = id;
        
        clientModal.classList.remove('hidden');
    } catch (error) {
        console.error('Erro ao editar cliente:', error);
        showMessage(error.message, 'error');
    }
}

function closeModal() {
    clientModal.classList.add('hidden');
}

// Manipular envio do formulário
clientForm.onsubmit = async (event) => {
    if (!checkAuth()) return;
    event.preventDefault();
    
    const id = event.target.dataset.id;
    const formData = new FormData(event.target);
    const data = {
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
        status: formData.get('status'),
        notes: formData.get('notes')
    };
    
    try {
        const response = await fetch(`/api/admin/clients/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error('Erro ao atualizar cliente');
        }
        
        showMessage('Cliente atualizado com sucesso!', 'success');
        closeModal();
        loadClients();
    } catch (error) {
        console.error('Erro ao salvar cliente:', error);
        showMessage(error.message, 'error');
    }
};

// Função para ver agendamentos do cliente
function viewAppointments(clientId) {
    window.location.href = `/admin/appointments.html?client_id=${clientId}`;
}

// Funções auxiliares
function formatDateTime(datetime) {
    const date = new Date(datetime);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getStatusClass(status) {
    return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
}

function getStatusText(status) {
    return status === 'active' ? 'Ativo' : 'Inativo';
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
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        info: 'bg-blue-500 text-white',
        warning: 'bg-yellow-500 text-white'
    };
    return classes[type] || classes.info;
}
