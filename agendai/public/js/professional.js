// Elementos do DOM
const loginForm = document.getElementById('login-form');
const dashboard = document.getElementById('dashboard');
const timeSlotsList = document.getElementById('time-slots');
const appointmentsList = document.getElementById('appointments-list');
const addTimeSlotModal = document.getElementById('add-time-slot-modal');

// Horários padrão disponíveis
const DEFAULT_TIME_SLOTS = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
    "20:00", "20:30", "21:00"
];

// Função para fazer login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        if (!response.ok) {
            throw new Error('Credenciais inválidas');
        }

        loginForm.classList.add('hidden');
        dashboard.classList.remove('hidden');
        
        // Carregar dados iniciais
        loadAppointments();
        loadTimeSlots();
    } catch (error) {
        showMessage(error.message, 'error');
    }
}

// Funções para gerenciar horários
function loadTimeSlots() {
    fetch('/api/time-slots')
        .then(response => response.json())
        .then(slots => {
            timeSlotsList.innerHTML = `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${getDaysOfWeek().map(day => `
                        <div class="border rounded p-4">
                            <h3 class="font-medium mb-2">${day.name}</h3>
                            <div class="space-y-2">
                                ${DEFAULT_TIME_SLOTS.map(time => `
                                    <div class="flex items-center">
                                        <input type="checkbox" 
                                            id="slot-${day.value}-${time}"
                                            ${isTimeSlotAvailable(slots, day.value, time) ? 'checked' : ''}
                                            onchange="toggleTimeSlot(${day.value}, '${time}', this.checked)"
                                            class="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50">
                                        <label for="slot-${day.value}-${time}" class="ml-2 text-sm text-gray-700">
                                            ${time}
                                        </label>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        });
}

function isTimeSlotAvailable(slots, dayOfWeek, time) {
    return slots.some(slot => 
        slot.day_of_week === dayOfWeek && 
        slot.start_time === time && 
        slot.is_available
    );
}

function toggleTimeSlot(dayOfWeek, time, isAvailable) {
    fetch('/api/time-slots', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            dayOfWeek,
            startTime: time,
            isAvailable
        })
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Erro ao atualizar horário');
        }
        showMessage('Horário atualizado com sucesso', 'success');
    })
    .catch(error => {
        showMessage(error.message, 'error');
        // Reverter checkbox
        document.getElementById(`slot-${dayOfWeek}-${time}`).checked = !isAvailable;
    });
}

function getDaysOfWeek() {
    return [
        { value: 1, name: 'Segunda-feira' },
        { value: 2, name: 'Terça-feira' },
        { value: 3, name: 'Quarta-feira' },
        { value: 4, name: 'Quinta-feira' },
        { value: 5, name: 'Sexta-feira' },
        { value: 6, name: 'Sábado' },
        { value: 0, name: 'Domingo' }
    ];
}

// Função para fazer logout
function handleLogout() {
    fetch('/api/logout', { method: 'POST' })
        .then(() => {
            dashboard.classList.add('hidden');
            loginForm.classList.remove('hidden');
        });
}

// Funções para gerenciar agendamentos
function loadAppointments() {
    fetch('/api/appointments')
        .then(response => response.json())
        .then(appointments => {
            appointmentsList.innerHTML = appointments.map(appointment => `
                <div class="flex justify-between items-center p-4 bg-gray-50 rounded">
                    <div>
                        <p class="font-medium">${appointment.client_name}</p>
                        <p class="text-sm text-gray-600">${formatDate(appointment.date)} às ${appointment.time}</p>
                        <p class="text-sm text-gray-500">${appointment.phone}</p>
                    </div>
                    <div class="flex space-x-2">
                        <span class="px-2 py-1 rounded ${getStatusClass(appointment.status)}">
                            ${getStatusText(appointment.status)}
                        </span>
                        <button onclick="updateAppointmentStatus(${appointment.id}, 'confirmed')"
                                class="text-green-600 hover:text-green-800">
                            Confirmar
                        </button>
                    </div>
                </div>
            `).join('');
        });
}

// Funções auxiliares
function getDayName(day) {
    const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    return days[day];
}

function getStatusClass(status) {
    const classes = {
        pending: 'bg-yellow-100 text-yellow-800',
        confirmed: 'bg-green-100 text-green-800',
        cancelled: 'bg-red-100 text-red-800'
    };
    return classes[status] || classes.pending;
}

function getStatusText(status) {
    const texts = {
        pending: 'Pendente',
        confirmed: 'Confirmado',
        cancelled: 'Cancelado'
    };
    return texts[status] || 'Pendente';
}

// Função para atualizar status do agendamento
async function updateAppointmentStatus(id, status) {
    try {
        const response = await fetch(`/api/appointments/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        if (!response.ok) {
            throw new Error('Erro ao atualizar status');
        }

        loadAppointments();
        showMessage('Status atualizado com sucesso', 'success');
    } catch (error) {
        showMessage(error.message, 'error');
    }
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
