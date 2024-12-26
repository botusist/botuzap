// Elementos do DOM
const loginForm = document.getElementById('login-form');

// Manipular envio do formulário
loginForm.onsubmit = async (event) => {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'Erro ao fazer login');
        }

        // Salvar dados do admin no localStorage
        localStorage.setItem('admin', JSON.stringify(result.admin));

        // Redirecionar para o dashboard após login bem sucedido
        window.location.href = '/admin/dashboard.html';
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        alert(error.message);
    }
};

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
