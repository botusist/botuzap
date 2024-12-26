// Estado global
let currentStep = 1;
let selectedProfessional = null;
let selectedDate = null;
let selectedTimeSlot = null;

// Elementos do DOM
const steps = [
    document.getElementById('step-1'),
    document.getElementById('step-2'),
    document.getElementById('step-3'),
    document.getElementById('step-4')
];

const prevButton = document.getElementById('prev-step');
const nextButton = document.getElementById('next-step');

// Carregar profissionais ao iniciar
document.addEventListener('DOMContentLoaded', loadProfessionals);

// Funções de navegação
function showStep(step) {
    steps.forEach((s, index) => {
        if (index + 1 === step) {
            s.classList.remove('hidden');
        } else {
            s.classList.add('hidden');
        }
    });

    // Atualizar botões de navegação
    prevButton.classList.toggle('hidden', step === 1);
    nextButton.classList.toggle('hidden', step === 4);

    currentStep = step;
}

function nextStep() {
    if (currentStep < 4) {
        if (validateStep()) {
            showStep(currentStep + 1);
            if (currentStep === 2) loadAvailableDates();
            if (currentStep === 3) loadAvailableTimeSlots();
        }
    }
}

function previousStep() {
    if (currentStep > 1) {
        showStep(currentStep - 1);
    }
}

// Validação de etapas
function validateStep() {
    switch (currentStep) {
        case 1:
            return selectedProfessional !== null;
        case 2:
            return selectedDate !== null;
        case 3:
            return selectedTimeSlot !== null;
        default:
            return true;
    }
}

// Carregar dados
async function loadProfessionals() {
    try {
        const response = await fetch('/api/professionals');
        const professionals = await response.json();

        document.getElementById('professionals-list').innerHTML = professionals
            .map(prof => `
                <div class="flex items-center p-4 border rounded cursor-pointer hover:bg-gray-50 ${
                    selectedProfessional === prof.id ? 'border-blue-500 bg-blue-50' : ''
                }"
                onclick="selectProfessional(${prof.id})">
                    <div class="flex-shrink-0 h-10 w-10">
                        <img class="h-10 w-10 rounded-full" src="/images/avatar-placeholder.png" alt="">
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${prof.name}</div>
                        <div class="text-sm text-gray-500">${prof.specialty || ''}</div>
                    </div>
                </div>
            `)
            .join('');
    } catch (error) {
        showMessage('Erro ao carregar profissionais', 'error');
    }
}

function selectProfessional(id) {
    selectedProfessional = id;
    document.querySelectorAll('#professionals-list > div').forEach(div => {
        div.classList.toggle('border-blue-500', div.getAttribute('data-id') == id);
        div.classList.toggle('bg-blue-50', div.getAttribute('data-id') == id);
    });
    nextButton.disabled = false;
}

function loadAvailableDates() {
    // Criar calendário do mês atual
    const today = new Date();
    const calendar = document.querySelector('#step-2 .grid');
    calendar.innerHTML = '';

    // Adicionar cabeçalho dos dias da semana
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    weekDays.forEach(day => {
        const dayHeader = document.createElement('div');
        dayHeader.className = 'text-center text-sm font-medium text-gray-500';
        dayHeader.textContent = day;
        calendar.appendChild(dayHeader);
    });

    // Adicionar dias do mês
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    // Adicionar espaços vazios para os dias antes do primeiro dia do mês
    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyDay = document.createElement('div');
        calendar.appendChild(emptyDay);
    }

    // Adicionar os dias do mês
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(today.getFullYear(), today.getMonth(), day);
        const dayElement = document.createElement('div');
        dayElement.className = `
            text-center p-2 cursor-pointer rounded
            ${date < today ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-blue-100'}
            ${selectedDate?.getDate() === day ? 'bg-blue-500 text-white' : ''}
        `;
        dayElement.textContent = day;
        
        if (date >= today) {
            dayElement.onclick = () => selectDate(date);
        }
        
        calendar.appendChild(dayElement);
    }
}

function selectDate(date) {
    selectedDate = date;
    loadAvailableDates(); // Recarregar para atualizar visual
    nextButton.disabled = false;
}

async function loadAvailableTimeSlots() {
    try {
        const response = await fetch(`/api/time-slots?professional=${selectedProfessional}&date=${selectedDate.toISOString()}`);
        const slots = await response.json();

        document.getElementById('time-slots-list').innerHTML = slots
            .map(slot => `
                <button
                    onclick="selectTimeSlot('${slot.id}')"
                    class="p-2 text-center border rounded ${
                        selectedTimeSlot === slot.id ? 'bg-blue-500 text-white' : 'hover:bg-gray-50'
                    }">
                    ${slot.time}
                </button>
            `)
            .join('');
    } catch (error) {
        showMessage('Erro ao carregar horários disponíveis', 'error');
    }
}

function selectTimeSlot(id) {
    selectedTimeSlot = id;
    document.querySelectorAll('#time-slots-list button').forEach(button => {
        button.classList.toggle('bg-blue-500', button.getAttribute('data-id') === id);
        button.classList.toggle('text-white', button.getAttribute('data-id') === id);
    });
    nextButton.disabled = false;
}

// Formulário do cliente
document.getElementById('client-form').onsubmit = async function(event) {
    event.preventDefault();

    const formData = new FormData(event.target);
    const data = {
        professionalId: selectedProfessional,
        date: selectedDate,
        timeSlotId: selectedTimeSlot,
        client: {
            name: formData.get('name'),
            phone: formData.get('phone')
        }
    };

    try {
        const response = await fetch('/api/appointments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error('Erro ao criar agendamento');
        }

        showMessage('Agendamento realizado com sucesso!', 'success');
        setTimeout(() => {
            window.location.href = '/';
        }, 2000);
    } catch (error) {
        showMessage(error.message, 'error');
    }
};

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
