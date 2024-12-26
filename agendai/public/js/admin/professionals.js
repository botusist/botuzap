// Elementos do DOM
const professionalsList = document.getElementById('professionals-list');
const professionalModal = document.getElementById('professional-modal');
const professionalForm = document.getElementById('professional-form');
const modalTitle = document.getElementById('modal-title');

// Verificar se o admin está logado
function checkAuth() {
    const admin = localStorage.getItem('admin');
    if (!admin) {
        window.location.href = '/admin/login.html';
        return false;
    }
    return true;
}

// Carregar lista de profissionais
document.addEventListener('DOMContentLoaded', () => {
    if (!checkAuth()) return;
    loadProfessionals();
});

async function loadProfessionals() {
    try {
        const response = await fetch('/api/admin/professionals', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            credentials: 'same-origin'
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error(data.error || 'Erro ao buscar profissionais');
        }
        
        if (!Array.isArray(data)) {
            console.error('Resposta inválida:', data);
            throw new Error('Resposta inválida do servidor');
        }
        
        if (data.length === 0) {
            professionalsList.innerHTML = `
                <tr>
                    <td colspan="5" class="px-6 py-4 text-center text-gray-500">
                        Nenhum profissional cadastrado
                    </td>
                </tr>
            `;
            return;
        }
        
        professionalsList.innerHTML = data.map(professional => `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                        <div class="text-sm font-medium text-gray-900">
                            ${professional.name}
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${professional.email}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-900">${professional.specialty || '-'}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${professional.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${professional.active ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <button onclick="showScheduleModal(${professional.id}, '${professional.name}')" class="text-blue-600 hover:text-blue-900">
                        Gerenciar Horários
                    </button>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="editProfessional(${professional.id})" class="text-indigo-600 hover:text-indigo-900 mr-4">Editar</button>
                    <button onclick="toggleProfessionalStatus(${professional.id}, ${!professional.active})" class="text-${professional.active ? 'red' : 'green'}-600 hover:text-${professional.active ? 'red' : 'green'}-900">
                        ${professional.active ? 'Desativar' : 'Ativar'}
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar profissionais:', error);
        showMessage('Erro ao carregar lista de profissionais: ' + error.message, 'error');
        professionalsList.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-4 text-center text-red-500">
                    Erro ao carregar profissionais. Por favor, tente novamente.
                </td>
            </tr>
        `;
    }
}

// Funções do Modal
function showAddProfessionalModal() {
    if (!checkAuth()) return;
    modalTitle.textContent = 'Adicionar Profissional';
    professionalForm.reset();
    professionalModal.classList.remove('hidden');
}

function closeModal() {
    professionalModal.classList.add('hidden');
}

async function editProfessional(id) {
    if (!checkAuth()) return;
    try {
        const response = await fetch(`/api/admin/professionals/${id}`, {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error('Erro ao buscar dados do profissional');
        }
        
        const professional = await response.json();
        
        modalTitle.textContent = 'Editar Profissional';
        professionalForm.elements.name.value = professional.name;
        professionalForm.elements.email.value = professional.email;
        professionalForm.elements.specialty.value = professional.specialty || '';
        professionalForm.dataset.id = id;
        
        professionalModal.classList.remove('hidden');
    } catch (error) {
        console.error('Erro ao editar profissional:', error);
        showMessage(error.message, 'error');
    }
}

// Manipular envio do formulário
professionalForm.onsubmit = async (event) => {
    if (!checkAuth()) return;
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        name: formData.get('name'),
        email: formData.get('email'),
        password: formData.get('password'),
        specialty: formData.get('specialty')
    };
    
    const id = event.target.dataset.id;
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/admin/professionals/${id}` : '/api/admin/professionals';
    
    try {
        // Se for edição e não tiver senha, remove do objeto
        if (id && !data.password) {
            delete data.password;
        }
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error(result.error || 'Erro ao salvar profissional');
        }
        
        showMessage(id ? 'Profissional atualizado com sucesso!' : 'Profissional criado com sucesso!', 'success');
        closeModal();
        loadProfessionals();
    } catch (error) {
        console.error('Erro ao salvar profissional:', error);
        showMessage(error.message, 'error');
    }
};

// Função para alternar status do profissional
async function toggleProfessionalStatus(id, active) {
    if (!checkAuth()) return;
    try {
        const response = await fetch(`/api/admin/professionals/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({ active })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error(result.error || 'Erro ao alterar status');
        }
        
        showMessage('Status alterado com sucesso!', 'success');
        loadProfessionals();
    } catch (error) {
        console.error('Erro ao alterar status:', error);
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
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        info: 'bg-blue-500 text-white',
        warning: 'bg-yellow-500 text-white'
    };
    return classes[type] || classes.info;
}

// Variáveis globais para o modal de horários
let currentProfessionalId = null;
let currentDay = 1; // Segunda-feira por padrão

// Função para mostrar o modal de horários
function showScheduleModal(professionalId, professionalName) {
    if (!checkAuth()) return;
    
    currentProfessionalId = professionalId;
    document.getElementById('professional-name').textContent = professionalName;
    document.getElementById('schedule-professional-id').value = professionalId;
    document.getElementById('schedule-day').value = currentDay;
    
    // Marcar a tab do dia atual como ativa
    updateActiveDayTab();
    
    // Carregar horários do dia
    loadSchedules(professionalId, currentDay);
    
    // Mostrar modal
    document.getElementById('schedule-modal').classList.remove('hidden');
}

// Função para esconder modais
function hideModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

// Função para trocar o dia selecionado
function switchDay(day) {
    currentDay = day;
    document.getElementById('schedule-day').value = day;
    updateActiveDayTab();
    loadSchedules(currentProfessionalId, day);
}

// Função para atualizar o visual das tabs
function updateActiveDayTab() {
    const tabs = document.querySelectorAll('.tab-button');
    tabs.forEach((tab, index) => {
        if (index === currentDay) {
            tab.classList.add('border-blue-500', 'text-blue-600');
            tab.classList.remove('border-transparent', 'text-gray-500');
        } else {
            tab.classList.remove('border-blue-500', 'text-blue-600');
            tab.classList.add('border-transparent', 'text-gray-500');
        }
    });
}

// Função para carregar horários do profissional
async function loadSchedules(professionalId, day) {
    if (!checkAuth()) return;
    
    try {
        const response = await fetch(`/api/admin/professionals/${professionalId}/availability?day=${day}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error('Erro ao carregar horários');
        }
        
        const schedules = await response.json();
        const scheduleList = document.getElementById('schedule-list');
        
        if (schedules.length === 0) {
            scheduleList.innerHTML = '<p class="text-gray-500">Nenhum horário cadastrado para este dia.</p>';
            return;
        }
        
        scheduleList.innerHTML = schedules.map(schedule => `
            <div class="flex justify-between items-center p-2 bg-gray-50 rounded">
                <div>
                    <span class="font-medium">${schedule.start_time}</span> às 
                    <span class="font-medium">${schedule.end_time}</span>
                    <span class="text-sm text-gray-500 ml-2">(${schedule.slot_duration} min/consulta)</span>
                </div>
                <button onclick="deleteSchedule(${schedule.id})" class="text-red-600 hover:text-red-900">
                    Excluir
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Erro ao carregar horários:', error);
        showMessage(error.message, 'error');
    }
}

// Função para excluir um horário
async function deleteSchedule(scheduleId) {
    if (!checkAuth()) return;
    
    if (!confirm('Tem certeza que deseja excluir este horário?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/professionals/${currentProfessionalId}/availability/${scheduleId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('admin');
                window.location.href = '/admin/login.html';
                return;
            }
            throw new Error('Erro ao excluir horário');
        }
        
        showMessage('Horário excluído com sucesso!', 'success');
        loadSchedules(currentProfessionalId, currentDay);
    } catch (error) {
        console.error('Erro ao excluir horário:', error);
        showMessage(error.message, 'error');
    }
}

// Configurar formulário de horários
document.getElementById('schedule-form').onsubmit = async (event) => {
    if (!checkAuth()) return;
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        dayOfWeek: parseInt(formData.get('schedule-day')),
        startTime: formData.get('startTime'),
        endTime: formData.get('endTime'),
        slotDuration: parseInt(formData.get('slotDuration'))
    };
    
    try {
        const response = await fetch(`/api/admin/professionals/${currentProfessionalId}/availability`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
            const error = await response.json();
            throw new Error(error.error || 'Erro ao salvar horário');
        }
        
        showMessage('Horário adicionado com sucesso!', 'success');
        event.target.reset();
        loadSchedules(currentProfessionalId, currentDay);
    } catch (error) {
        console.error('Erro ao salvar horário:', error);
        showMessage(error.message, 'error');
    }
};
