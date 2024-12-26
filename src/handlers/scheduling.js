const whatsapp = require('../whatsapp/client');

// Exemplo de profissionais e horários (você pode adaptar para seu banco de dados)
const professionals = [
    { id: 1, name: 'Dr. João', specialty: 'Clínico Geral' },
    { id: 2, name: 'Dra. Maria', specialty: 'Pediatra' }
];

const timeSlots = [
    '09:00', '10:00', '11:00', '14:00', '15:00', '16:00'
];

// Estado da conversa com cada usuário
const userStates = new Map();

// Função para inicializar o sistema de agendamento
function initializeSchedulingSystem() {
    whatsapp.onMessage(async (message) => {
        if (message.type !== 'text') return;

        const userPhone = message.from;
        const text = message.content.toLowerCase();
        
        // Inicializa estado do usuário se não existir
        if (!userStates.has(userPhone)) {
            userStates.set(userPhone, { step: 'initial' });
        }

        const state = userStates.get(userPhone);

        try {
            switch (state.step) {
                case 'initial':
                    if (text.includes('agendar') || text.includes('marcar') || text.includes('consulta')) {
                        state.step = 'choosing_professional';
                        const professionalList = professionals
                            .map(p => `${p.id}. ${p.name} (${p.specialty})`)
                            .join('\n');
                        
                        await whatsapp.sendText(userPhone, 
                            `Ótimo! Com qual profissional você gostaria de agendar?\n\n${professionalList}\n\nDigite o número do profissional escolhido.`
                        );
                    } else {
                        await whatsapp.sendText(userPhone,
                            'Olá! Como posso ajudar? Para agendar uma consulta, digite "agendar".'
                        );
                    }
                    break;

                case 'choosing_professional':
                    const professionalId = parseInt(text);
                    const professional = professionals.find(p => p.id === professionalId);
                    
                    if (professional) {
                        state.professional = professional;
                        state.step = 'choosing_date';
                        
                        await whatsapp.sendText(userPhone,
                            'Para qual data você gostaria de agendar? (formato: DD/MM/YYYY)'
                        );
                    } else {
                        await whatsapp.sendText(userPhone,
                            'Profissional não encontrado. Por favor, escolha um número válido.'
                        );
                    }
                    break;

                case 'choosing_date':
                    // Validação simples de data (você pode melhorar isso)
                    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
                    if (dateRegex.test(text)) {
                        state.date = text;
                        state.step = 'choosing_time';
                        
                        const timeSlotList = timeSlots.join('\n');
                        await whatsapp.sendText(userPhone,
                            `Horários disponíveis para ${state.date}:\n\n${timeSlotList}\n\nDigite o horário desejado.`
                        );
                    } else {
                        await whatsapp.sendText(userPhone,
                            'Data inválida. Por favor, use o formato DD/MM/YYYY.'
                        );
                    }
                    break;

                case 'choosing_time':
                    if (timeSlots.includes(text)) {
                        state.time = text;
                        state.step = 'confirming';
                        
                        await whatsapp.sendText(userPhone,
                            `Por favor, confirme seu agendamento:\n\n` +
                            `Profissional: ${state.professional.name}\n` +
                            `Data: ${state.date}\n` +
                            `Horário: ${state.time}\n\n` +
                            `Digite "confirmar" para finalizar ou "cancelar" para recomeçar.`
                        );
                    } else {
                        await whatsapp.sendText(userPhone,
                            'Horário inválido. Por favor, escolha um dos horários disponíveis.'
                        );
                    }
                    break;

                case 'confirming':
                    if (text === 'confirmar') {
                        // Aqui você implementaria a lógica de salvar no banco de dados
                        
                        await whatsapp.sendText(userPhone,
                            `✅ Agendamento confirmado!\n\n` +
                            `Profissional: ${state.professional.name}\n` +
                            `Data: ${state.date}\n` +
                            `Horário: ${state.time}\n\n` +
                            `Aguardamos você!`
                        );
                        
                        // Limpa o estado do usuário
                        userStates.delete(userPhone);
                    } 
                    else if (text === 'cancelar') {
                        userStates.delete(userPhone);
                        await whatsapp.sendText(userPhone,
                            'Agendamento cancelado. Digite "agendar" quando quiser começar novamente.'
                        );
                    }
                    else {
                        await whatsapp.sendText(userPhone,
                            'Por favor, digite "confirmar" para finalizar ou "cancelar" para recomeçar.'
                        );
                    }
                    break;
            }
        } catch (error) {
            console.error('Erro no processamento:', error);
            await whatsapp.sendText(userPhone,
                'Desculpe, ocorreu um erro. Por favor, tente novamente digitando "agendar".'
            );
            userStates.delete(userPhone);
        }
    });
}

module.exports = {
    initializeSchedulingSystem
};
