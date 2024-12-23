const express = require('express');
const path = require('path');
const app = express();

// Servir arquivos estáticos
app.use('/', express.static('public'));

// Rota raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'test.html'));
});

// Iniciar servidor
const port = 3001;
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
