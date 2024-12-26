// Elementos do DOM
const appointmentsList = document.getElementById('appointments-list');
const appointmentModal = document.getElementById('appointment-modal');
const appointmentForm = document.getElementById('appointment-form');
const modalTitle = document.getElementById('modal-title');
const dateFilter = document.getElementById('date-filter');
const professionalFilter = document.getElementById('professional-filter');
const statusFilter = document.getElementById('status-filter');

// Inicializar Flatpickr para o filtro de data
flatpickr(dateFilter, {
    locale: 'pt',
    dateFormat: 'd/m/Y',
    allowInput: true
});

// Verificar se o admin está logado
function checkAuth() {
    const admin = localStorage.getItem('admin');
    if (!admin) {
        window.location.href = '/admin/login.html';
        return false;
    }
    return true;
}

// Carregar lista de agendamentos
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    loadProfessionals();
    loadAppointments();
});

// Carregar profissionais para o filtro
async function loadProfessionals() {
    try {
        const response = await fetch('/api/admin/professionals', {
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error('Erro ao buscar profissionais');
        }
        
        const professionals = await response.json();
        
        professionalFilter.innerHTML = '<option value="">Todos</option>' +
            professionals.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    } catch (error) {
        console.error('Erro ao carregar profissionais:', error);
        showMessage(error.message, 'error');
    }
}

// Carregar agendamentos com filtros
async function loadAppointments() {
    try {
        let url = '/api/admin/appointments';
        const filters = [];
        
        if (dateFilter.value) {
            const date = flatpickr.parseDate(dateFilter.value, 'd/m/Y');
            if (date) {
                const formattedDate = date.toISOString().split('T')[0];
                console.log('Data formatada:', formattedDate);
                filters.push(`date=${formattedDate}`);
            }
        }
        if (professionalFilter.value && professionalFilter.value !== 'Todos') {
            filters.push(`professional_id=${professionalFilter.value}`);
        }
        if (statusFilter.value && statusFilter.value !== 'Todos') {
            filters.push(`status=${statusFilter.value}`);
        }
        
        if (filters.length > 0) {
            url += '?' + filters.join('&');
        }
        
        console.log('URL da requisição:', url);
        
        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error(errorData.error || 'Erro ao buscar agendamentos');
        }
        
        const appointments = await response.json();
        console.log('Agendamentos recebidos:', appointments);
        
        if (appointments.length === 0) {
            appointmentsList.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                        Nenhum agendamento encontrado
                    </td>
                </tr>
            `;
            return;
        }
        
        appointmentsList.innerHTML = appointments.map(appointment => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                        ${formatDateTime(appointment.datetime)}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                        ${appointment.client_name || 'N/A'}
                        ${appointment.client_phone ? `<br><span class="text-gray-500">${appointment.client_phone}</span>` : ''}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">
                        ${appointment.professional_name || 'N/A'}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusClass(appointment.status)}">
                        ${getStatusText(appointment.status)}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="editAppointment(${appointment.id})" class="text-indigo-600 hover:text-indigo-900">
                        Editar
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar agendamentos:', error);
        appointmentsList.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-red-500">
                    Erro ao carregar agendamentos. Por favor, tente novamente.
                </td>
            </tr>
        `;
        showMessage(error.message, 'error');
    }
}

// Função para aplicar filtros
function applyFilters() {
    loadAppointments();
}

// Funções do Modal
async function editAppointment(id) {
    if (!checkAuth()) return;
    try {
        const response = await fetch(`/api/admin/appointments/${id}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error('Erro ao buscar dados do agendamento');
        }
        
        const appointment = await response.json();
        
        appointmentForm.elements.client.value = appointment.client_name;
        appointmentForm.elements.professional.value = appointment.professional_name;
        appointmentForm.elements.datetime.value = formatDateTime(appointment.datetime);
        appointmentForm.elements.status.value = appointment.status;
        appointmentForm.elements.notes.value = appointment.notes || '';
        appointmentForm.dataset.id = id;
        
        appointmentModal.classList.remove('hidden');
    } catch (error) {
        console.error('Erro ao editar agendamento:', error);
        showMessage(error.message, 'error');
    }
}

function closeModal() {
    appointmentModal.classList.add('hidden');
}

// Manipular envio do formulário
appointmentForm.onsubmit = async (event) => {
    if (!checkAuth()) return;
    event.preventDefault();
    
    const id = event.target.dataset.id;
    const data = {
        status: event.target.elements.status.value,
        notes: event.target.elements.notes.value
    };
    
    try {
        const response = await fetch(`/api/admin/appointments/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error('Erro ao atualizar agendamento');
        }
        
        showMessage('Agendamento atualizado com sucesso!', 'success');
        closeModal();
        loadAppointments();
    } catch (error) {
        console.error('Erro ao salvar agendamento:', error);
        showMessage(error.message, 'error');
    }
};

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
    const classes = {
        pending: 'bg-yellow-100 text-yellow-800',
        confirmed: 'bg-green-100 text-green-800',
        completed: 'bg-blue-100 text-blue-800',
        cancelled: 'bg-red-100 text-red-800'
    };
    return classes[status] || classes.pending;
}

function getStatusText(status) {
    const texts = {
        pending: 'Pendente',
        confirmed: 'Confirmado',
        completed: 'Concluído',
        cancelled: 'Cancelado'
    };
    return texts[status] || 'Pendente';
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
