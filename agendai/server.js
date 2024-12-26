const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const upload = require('multer')();
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Configuração do banco de dados
const dbFile = path.join(__dirname, 'database.sqlite');
const exists = fs.existsSync(dbFile);

console.log('\n=== Configuração do Banco de Dados ===');
console.log('Arquivo do banco:', dbFile);
console.log('Já existe?', exists);

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
    process.exit(1);
  }
  console.log('Conectado ao banco de dados SQLite');
  
  // Habilitar foreign keys
  db.run('PRAGMA foreign_keys = ON', (err) => {
    if (err) {
      console.error('Erro ao habilitar foreign keys:', err);
      return;
    }
    console.log('Foreign keys habilitadas');
    
    // Inicializar banco de dados
    initializeDatabase();
  });
});

// Configuração do Express
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configuração da sessão
app.use(session({
  secret: 'agendai-secret-key-2024',
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Middleware para todas as requisições
app.use((req, res, next) => {
  console.log('\n=== Nova Requisição ===');
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  console.log('Session ID:', req.sessionID);
  console.log('Session:', req.session);
  next();
});

// Middleware de autenticação para API admin
function requireAdmin(req, res, next) {
  console.log('\n=== Verificando Autenticação ===');
  console.log('Session ID:', req.sessionID);
  console.log('Session:', req.session);
  console.log('Cookies:', req.headers.cookie);
  
  if (!req.session || !req.session.admin) {
    console.log('Não autorizado: sessão admin não encontrada');
    return res.status(401).json({ error: 'Não autorizado' });
  }
  console.log('Autorizado como admin:', req.session.admin);
  next();
}

// Middleware para logging
app.use((req, res, next) => {
  console.log('\n=== Nova Requisição ===');
  console.log(`${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  console.log('Session ID:', req.sessionID);
  console.log('Session:', req.session);
  console.log('Cookies:', req.headers.cookie);
  next();
});

// Middleware de autenticação para páginas admin
function requireAdminPage(req, res, next) {
  if (!req.session || !req.session.admin) {
    return res.redirect('/admin/login.html');
  }
  next();
}

// Rotas específicas para as páginas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/professional.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'professional.html'));
});

app.get('/schedule.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'schedule.html'));
});

app.get('/settings.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

// Rota para redirecionar /admin para /admin/login.html
app.get('/admin', (req, res) => {
  res.redirect('/admin/login.html');
});

app.get('/admin/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'login.html'));
});

app.get('/admin/dashboard.html', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'dashboard.html'));
});

app.get('/admin/professionals.html', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'professionals.html'));
});

app.get('/admin/settings.html', requireAdminPage, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin', 'settings.html'));
});

// Rotas da API
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get('SELECT * FROM professionals WHERE email = ?', [email], (err, professional) => {
    if (err) {
      return res.status(500).json({ error: 'Erro interno do servidor' });
    }
    
    if (!professional || !bcrypt.compareSync(password, professional.password)) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }
    
    req.session.professionalId = professional.id;
    res.json({ success: true });
  });
});

app.get('/api/appointments', (req, res) => {
  const professionalId = req.session.professionalId;
  
  if (!professionalId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  
  db.all(`
    SELECT a.*, c.name as client_name, c.phone 
    FROM appointments a 
    JOIN clients c ON a.client_id = c.id 
    WHERE a.professional_id = ? 
    ORDER BY date, time
  `, [professionalId], (err, appointments) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar agendamentos' });
    }
    res.json(appointments);
  });
});

app.get('/api/settings', (req, res) => {
  db.get('SELECT * FROM settings WHERE id = 1', (err, settings) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar configurações' });
    }
    res.json(settings || {});
  });
});

app.post('/api/settings', (req, res) => {
  const { openai } = req.body;
  
  db.run(`
    INSERT OR REPLACE INTO settings (id, openai_key, openai_model, openai_prompt, openai_temperature)
    VALUES (1, ?, ?, ?, ?)
  `, [openai.apiKey, openai.model, openai.prompt, openai.temperature], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao salvar configurações' });
    }
    res.json({ success: true });
  });
});

app.get('/api/admin/dashboard', requireAdmin, (req, res) => {
  console.log('Carregando dados do dashboard...');
  
  Promise.all([
    // Total de profissionais ativos
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM professionals WHERE active = 1', (err, result) => {
        if (err) {
          console.error('Erro ao contar profissionais:', err);
          reject(err);
        } else {
          resolve(result.count);
        }
      });
    }),
    
    // Agendamentos para hoje
    new Promise((resolve, reject) => {
      const today = new Date().toISOString().split('T')[0];
      db.get('SELECT COUNT(*) as count FROM appointments WHERE date = ?', [today], (err, result) => {
        if (err) {
          console.error('Erro ao contar agendamentos de hoje:', err);
          reject(err);
        } else {
          resolve(result.count);
        }
      });
    }),
    
    // Total de clientes
    new Promise((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM clients', (err, result) => {
        if (err) {
          console.error('Erro ao contar clientes:', err);
          reject(err);
        } else {
          resolve(result.count);
        }
      });
    }),
    
    // Taxa de conclusão
    new Promise((resolve, reject) => {
      db.get(`
        SELECT 
          ROUND(CAST(COUNT(CASE WHEN status = 'completed' THEN 1 END) AS FLOAT) / 
          CAST(COUNT(*) AS FLOAT) * 100, 1) as rate
        FROM appointments
        WHERE date < date('now')
      `, (err, result) => {
        if (err) {
          console.error('Erro ao calcular taxa de conclusão:', err);
          reject(err);
        } else {
          resolve(result.rate || 0);
        }
      });
    }),
    
    // Agendamentos recentes
    new Promise((resolve, reject) => {
      db.all(`
        SELECT 
          a.id,
          c.name as client_name,
          p.name as professional_name,
          a.date,
          a.time,
          a.status
        FROM appointments a
        JOIN clients c ON a.client_id = c.id
        JOIN professionals p ON a.professional_id = p.id
        ORDER BY a.date DESC, a.time DESC
        LIMIT 5
      `, (err, appointments) => {
        if (err) {
          console.error('Erro ao buscar agendamentos recentes:', err);
          reject(err);
        } else {
          resolve(appointments);
        }
      });
    })
  ])
  .then(([professionals, todayAppointments, clients, completionRate, recentAppointments]) => {
    const data = {
      professionals,
      todayAppointments,
      clients,
      completionRate,
      recentAppointments
    };
    console.log('Dados do dashboard carregados com sucesso:', data);
    res.json(data);
  })
  .catch(err => {
    console.error('Erro ao carregar dados do dashboard:', err);
    res.status(500).json({ error: 'Erro ao carregar dados do dashboard' });
  });
});

app.get('/api/admin/professionals', requireAdmin, (req, res) => {
  console.log('Listando profissionais. Sessão:', req.session);
  
  db.all('SELECT id, name, email, specialty, active FROM professionals', [], (err, professionals) => {
    if (err) {
      console.error('Erro ao buscar profissionais:', err);
      return res.status(500).json({ error: 'Erro ao buscar profissionais' });
    }
    res.json(professionals || []);
  });
});

app.get('/api/admin/professionals/:id', requireAdmin, (req, res) => {
  console.log('Buscando profissional:', req.params.id);
  db.get('SELECT id, name, email, specialty, active, created_at FROM professionals WHERE id = ?', [req.params.id], (err, professional) => {
    if (err) {
      console.error('Erro ao buscar profissional:', err);
      return res.status(500).json({ error: 'Erro ao buscar profissional' });
    }
    if (!professional) {
      console.log('Profissional não encontrado:', req.params.id);
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }
    console.log('Profissional encontrado:', professional);
    res.json(professional);
  });
});

app.post('/api/admin/login', (req, res) => {
  console.log('\n=== Tentativa de Login ===');
  console.log('Body:', req.body);
  console.log('Session ID antes:', req.sessionID);
  console.log('Session antes:', req.session);

  const { email, password } = req.body;

  if (!email || !password) {
    console.log('Email ou senha não fornecidos');
    return res.status(400).json({ error: 'Email e senha são obrigatórios' });
  }

  db.get('SELECT * FROM admins WHERE email = ?', [email], (err, admin) => {
    if (err) {
      console.error('Erro ao buscar admin:', err);
      return res.status(500).json({ error: 'Erro ao fazer login' });
    }

    if (!admin) {
      console.log('Admin não encontrado');
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    if (!bcrypt.compareSync(password, admin.password)) {
      console.log('Senha incorreta');
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Configurar sessão
    req.session.regenerate((err) => {
      if (err) {
        console.error('Erro ao regenerar sessão:', err);
        return res.status(500).json({ error: 'Erro ao fazer login' });
      }

      req.session.admin = {
        id: admin.id,
        email: admin.email,
        name: admin.name
      };

      req.session.save((err) => {
        if (err) {
          console.error('Erro ao salvar sessão:', err);
          return res.status(500).json({ error: 'Erro ao fazer login' });
        }

        console.log('Login bem sucedido');
        console.log('Session ID depois:', req.sessionID);
        console.log('Session depois:', req.session);
        console.log('Set-Cookie:', res.getHeader('set-cookie'));

        res.json({
          success: true,
          admin: {
            id: admin.id,
            email: admin.email,
            name: admin.name
          }
        });
      });
    });
  });
});

app.post('/api/admin/professionals', requireAdmin, (req, res) => {
  console.log('Criando profissional:', req.body);
  const { name, email, specialty } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Campos obrigatórios não preenchidos' });
  }

  db.run(
    'INSERT INTO professionals (name, email, specialty) VALUES (?, ?, ?)',
    [name, email, specialty],
    function(err) {
      if (err) {
        console.error('Erro ao criar profissional:', err);
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email já cadastrado' });
        }
        return res.status(500).json({ error: 'Erro ao criar profissional' });
      }
      
      res.status(201).json({
        id: this.lastID,
        name,
        email,
        specialty
      });
    }
  );
});

app.put('/api/admin/professionals/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, email, specialty, active } = req.body;

  let sql = 'UPDATE professionals SET ';
  const params = [];
  const updates = [];

  if (name) {
    updates.push('name = ?');
    params.push(name);
  }
  if (email) {
    updates.push('email = ?');
    params.push(email);
  }
  if (specialty !== undefined) {
    updates.push('specialty = ?');
    params.push(specialty);
  }
  if (active !== undefined) {
    updates.push('active = ?');
    params.push(active);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar' });
  }

  sql += updates.join(', ') + ' WHERE id = ?';
  params.push(id);

  db.run(sql, params, function(err) {
    if (err) {
      console.error('Erro ao atualizar profissional:', err);
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
      return res.status(500).json({ error: 'Erro ao atualizar profissional' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }
    
    res.json({ success: true });
  });
});

app.delete('/api/admin/professionals/:id', requireAdmin, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM professionals WHERE id = ?', [id], function(err) {
    if (err) {
      console.error('Erro ao excluir profissional:', err);
      return res.status(500).json({ error: 'Erro ao excluir profissional' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Profissional não encontrado' });
    }
    
    res.json({ success: true });
  });
});

app.get('/api/admin/system-status', requireAdmin, (req, res) => {
  res.json({
    system: {
      state: 'connected',
      message: 'Sistema funcionando normalmente'
    },
    database: {
      state: 'connected',
      message: 'Banco de dados conectado'
    }
  });
});

app.post('/api/admin/logout', requireAdmin, (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Erro ao fazer logout:', err);
      return res.status(500).json({ error: 'Erro ao fazer logout' });
    }
    res.clearCookie('agendai.sid');
    res.json({ success: true });
  });
});

// Rotas de configurações
app.get('/api/admin/settings/openai', requireAdmin, (req, res) => {
  db.get('SELECT * FROM settings WHERE id = 1', (err, settings) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar configurações OpenAI' });
    }
    res.json({
      apiKey: settings?.openai_key || '',
      model: settings?.openai_model || 'gpt-3.5-turbo',
      prompt: settings?.openai_prompt || '',
      temperature: settings?.openai_temperature || 0.7
    });
  });
});

app.post('/api/admin/settings/openai', requireAdmin, (req, res) => {
  const { apiKey, model, prompt, temperature } = req.body;
  
  db.run(`
    INSERT OR REPLACE INTO settings (id, openai_key, openai_model, openai_prompt, openai_temperature)
    VALUES (1, ?, ?, ?, ?)
  `, [apiKey, model, prompt, temperature], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao salvar configurações OpenAI' });
    }
    res.json({ success: true });
  });
});

app.get('/api/admin/settings/general', requireAdmin, (req, res) => {
  db.get('SELECT * FROM business_settings WHERE id = 1', (err, settings) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar configurações gerais' });
    }
    res.json(settings || {
      businessName: '',
      openingTime: '09:00',
      closingTime: '18:00',
      workDays: [1,2,3,4,5]
    });
  });
});

app.post('/api/admin/settings/general', requireAdmin, (req, res) => {
  const { businessName, openingTime, closingTime, workDays } = req.body;
  
  db.run(`
    INSERT OR REPLACE INTO business_settings (id, business_name, opening_time, closing_time, work_days)
    VALUES (1, ?, ?, ?, ?)
  `, [businessName, openingTime, closingTime, JSON.stringify(workDays)], (err) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao salvar configurações gerais' });
    }
    res.json({ success: true });
  });
});

// Rotas de backup e restauração
app.get('/api/admin/backup', requireAdmin, (req, res) => {
  Promise.all([
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM settings', (err, settings) => {
        if (err) reject(err);
        else resolve({ settings });
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM business_settings', (err, businessSettings) => {
        if (err) reject(err);
        else resolve({ businessSettings });
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM professionals', (err, professionals) => {
        if (err) reject(err);
        else resolve({ professionals });
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM clients', (err, clients) => {
        if (err) reject(err);
        else resolve({ clients });
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM appointments', (err, appointments) => {
        if (err) reject(err);
        else resolve({ appointments });
      });
    })
  ])
  .then(results => {
    const backup = Object.assign({}, ...results);
    res.json(backup);
  })
  .catch(err => {
    console.error('Erro ao gerar backup:', err);
    res.status(500).json({ error: 'Erro ao gerar backup' });
  });
});

app.post('/api/admin/restore', requireAdmin, upload.single('backup'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado' });
  }

  try {
    const backup = JSON.parse(req.file.buffer.toString());
    
    db.serialize(() => {
      // Restaurar configurações
      if (backup.settings) {
        backup.settings.forEach(setting => {
          db.run(`INSERT OR REPLACE INTO settings (id, openai_key, openai_model, openai_prompt, openai_temperature)
                 VALUES (?, ?, ?, ?, ?)`, [setting.id, setting.openai_key, setting.openai_model, setting.openai_prompt, setting.openai_temperature]);
        });
      }

      // Restaurar configurações do negócio
      if (backup.businessSettings) {
        backup.businessSettings.forEach(setting => {
          db.run(`INSERT OR REPLACE INTO business_settings (id, business_name, opening_time, closing_time, work_days)
                 VALUES (?, ?, ?, ?, ?)`, [setting.id, setting.business_name, setting.opening_time, setting.closing_time, setting.work_days]);
        });
      }

      // Restaurar profissionais
      if (backup.professionals) {
        backup.professionals.forEach(professional => {
          db.run(`INSERT OR REPLACE INTO professionals (id, name, email, specialty, active)
                 VALUES (?, ?, ?, ?, ?)`, [professional.id, professional.name, professional.email, professional.specialty, professional.active]);
        });
      }

      // Restaurar clientes
      if (backup.clients) {
        backup.clients.forEach(client => {
          db.run(`INSERT OR REPLACE INTO clients (id, name, phone)
                 VALUES (?, ?, ?)`, [client.id, client.name, client.phone]);
        });
      }

      // Restaurar agendamentos
      if (backup.appointments) {
        backup.appointments.forEach(appointment => {
          db.run(`INSERT OR REPLACE INTO appointments (id, client_id, professional_id, date, time, status)
                 VALUES (?, ?, ?, ?, ?, ?)`, [appointment.id, appointment.client_id, appointment.professional_id, appointment.date, appointment.time, appointment.status]);
        });
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao restaurar backup:', error);
    res.status(500).json({ error: 'Erro ao restaurar backup' });
  }
});

// Rotas de agendamentos
app.get('/api/admin/appointments', requireAdmin, (req, res) => {
  console.log('\n=== Buscando Agendamentos ===');
  console.log('Query params:', req.query);
  console.log('Session:', req.session);

  // Verificar se as tabelas existem
  db.serialize(() => {
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'`, [], (err, table) => {
      if (err) {
        console.error('Erro ao verificar tabela appointments:', err);
        return res.status(500).json({ error: 'Erro interno do servidor' });
      }

      if (!table) {
        console.error('Tabela appointments não existe');
        return res.status(500).json({ error: 'Tabela de agendamentos não encontrada' });
      }

      console.log('Tabela appointments existe:', table);

      let sql = `
        SELECT 
          a.*,
          c.name as client_name,
          c.phone as client_phone,
          p.name as professional_name
        FROM appointments a
        LEFT JOIN clients c ON a.client_id = c.id
        LEFT JOIN professionals p ON a.professional_id = p.id
        WHERE 1=1
      `;
      const params = [];

      if (req.query.date) {
        sql += " AND date(a.datetime) = date(?)";
        params.push(req.query.date);
      }
      if (req.query.professional_id && req.query.professional_id !== 'Todos') {
        sql += ' AND a.professional_id = ?';
        params.push(req.query.professional_id);
      }
      if (req.query.status && req.query.status !== 'Todos') {
        sql += ' AND a.status = ?';
        params.push(req.query.status);
      }
      if (req.query.client_id) {
        sql += ' AND a.client_id = ?';
        params.push(req.query.client_id);
      }

      sql += ' ORDER BY a.datetime DESC';

      console.log('SQL:', sql);
      console.log('Params:', params);

      db.all(sql, params, (err, appointments) => {
        if (err) {
          console.error('Erro ao buscar agendamentos:', err);
          return res.status(500).json({ error: 'Erro ao buscar agendamentos' });
        }
        console.log('Agendamentos encontrados:', appointments?.length || 0);
        console.log('Dados:', appointments);
        res.json(appointments || []);
      });
    });
  });
});

app.get('/api/admin/appointments/:id', requireAdmin, (req, res) => {
  const { id } = req.params;

  const sql = `
    SELECT 
      a.*,
      c.name as client_name,
      c.phone as client_phone,
      p.name as professional_name
    FROM appointments a
    JOIN clients c ON a.client_id = c.id
    JOIN professionals p ON a.professional_id = p.id
    WHERE a.id = ?
  `;

  db.get(sql, [id], (err, appointment) => {
    if (err) {
      console.error('Erro ao buscar agendamento:', err);
      return res.status(500).json({ error: 'Erro ao buscar agendamento' });
    }
    if (!appointment) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    res.json(appointment);
  });
});

app.put('/api/admin/appointments/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!status) {
    return res.status(400).json({ error: 'Status é obrigatório' });
  }

  const sql = 'UPDATE appointments SET status = ?, notes = ?, updated_at = DATETIME("now") WHERE id = ?';
  db.run(sql, [status, notes, id], function(err) {
    if (err) {
      console.error('Erro ao atualizar agendamento:', err);
      return res.status(500).json({ error: 'Erro ao atualizar agendamento' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Agendamento não encontrado' });
    }
    res.json({ success: true });
  });
});

// Rotas de clientes
app.get('/api/admin/clients', requireAdmin, (req, res) => {
  let sql = `
    SELECT 
      c.*,
      (SELECT datetime FROM appointments WHERE client_id = c.id ORDER BY datetime DESC LIMIT 1) as last_appointment
    FROM clients c
    WHERE 1=1
  `;
  const params = [];

  if (req.query.search) {
    sql += ' AND (c.name LIKE ? OR c.phone LIKE ?)';
    const searchTerm = `%${req.query.search}%`;
    params.push(searchTerm, searchTerm);
  }
  if (req.query.status) {
    sql += ' AND c.status = ?';
    params.push(req.query.status);
  }

  sql += ' ORDER BY c.name';

  db.all(sql, params, (err, clients) => {
    if (err) {
      console.error('Erro ao buscar clientes:', err);
      return res.status(500).json({ error: 'Erro ao buscar clientes' });
    }
    res.json(clients);
  });
});

app.get('/api/admin/clients/:id', requireAdmin, (req, res) => {
  const { id } = req.params;

  db.get('SELECT * FROM clients WHERE id = ?', [id], (err, client) => {
    if (err) {
      console.error('Erro ao buscar cliente:', err);
      return res.status(500).json({ error: 'Erro ao buscar cliente' });
    }
    if (!client) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json(client);
  });
});

app.put('/api/admin/clients/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, phone, email, status, notes } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Nome e telefone são obrigatórios' });
  }

  const sql = `
    UPDATE clients 
    SET name = ?, phone = ?, email = ?, status = ?, notes = ?, updated_at = DATETIME('now')
    WHERE id = ?
  `;

  db.run(sql, [name, phone, email, status, notes, id], function(err) {
    if (err) {
      console.error('Erro ao atualizar cliente:', err);
      return res.status(500).json({ error: 'Erro ao atualizar cliente' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Cliente não encontrado' });
    }
    res.json({ success: true });
  });
});

// Rota para testar o banco
app.get('/api/admin/debug/database', requireAdmin, (req, res) => {
  console.log('\n=== Debug do Banco de Dados ===');
  
  Promise.all([
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM professionals', [], (err, professionals) => {
        if (err) reject(err);
        else resolve({ table: 'professionals', data: professionals });
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM clients', [], (err, clients) => {
        if (err) reject(err);
        else resolve({ table: 'clients', data: clients });
      });
    }),
    new Promise((resolve, reject) => {
      db.all('SELECT * FROM appointments', [], (err, appointments) => {
        if (err) reject(err);
        else resolve({ table: 'appointments', data: appointments });
      });
    })
  ])
  .then(results => {
    console.log('Resultados:', JSON.stringify(results, null, 2));
    res.json(results);
  })
  .catch(err => {
    console.error('Erro:', err);
    res.status(500).json({ error: err.message });
  });
});

// Rotas de disponibilidade
app.get('/api/admin/professionals/:id/availability', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { day } = req.query;

  db.all('SELECT * FROM availability WHERE professional_id = ? AND day_of_week = ? ORDER BY start_time', 
    [id, day], (err, schedules) => {
      if (err) {
        console.error('Erro ao buscar horários:', err);
        return res.status(500).json({ error: 'Erro ao buscar horários' });
      }
      res.json(schedules || []);
    });
});

app.post('/api/admin/professionals/:id/availability', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { dayOfWeek, startTime, endTime, slotDuration } = req.body;

  console.log('Adicionando disponibilidade:', { id, dayOfWeek, startTime, endTime, slotDuration });

  if (!dayOfWeek || !startTime || !endTime || !slotDuration) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  db.run(`INSERT INTO availability (professional_id, day_of_week, start_time, end_time, slot_duration)
          VALUES (?, ?, ?, ?, ?)`,
    [id, dayOfWeek, startTime, endTime, slotDuration],
    function(err) {
      if (err) {
        console.error('Erro ao adicionar horário:', err);
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Horário já cadastrado' });
        }
        return res.status(500).json({ error: 'Erro ao adicionar horário' });
      }
      res.status(201).json({
        id: this.lastID,
        professional_id: id,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        slot_duration: slotDuration
      });
    });
});

app.delete('/api/admin/professionals/:professionalId/availability/:scheduleId', requireAdmin, (req, res) => {
  const { professionalId, scheduleId } = req.params;

  db.run('DELETE FROM availability WHERE id = ? AND professional_id = ?',
    [scheduleId, professionalId],
    function(err) {
      if (err) {
        console.error('Erro ao excluir horário:', err);
        return res.status(500).json({ error: 'Erro ao excluir horário' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Horário não encontrado' });
      }
      res.json({ success: true });
    });
});

// Configuração do WhatsApp
const client = new Client({
  puppeteer: {
    headless: true,
    args: ['--no-sandbox']
  }
});

client.on('qr', (qr) => {
  // Gerar QR code e emitir para o frontend
  qrcode.toDataURL(qr, (err, url) => {
    if (err) {
      console.error('Erro ao gerar QR code:', err);
      return;
    }
    io.emit('whatsapp-qr', url);
  });
});

client.on('ready', () => {
  console.log('Cliente WhatsApp conectado!');
  io.emit('whatsapp-status', { status: 'connected' });
});

client.on('message', async msg => {
  if (msg.body.toLowerCase().startsWith('/agendar')) {
    handleSchedulingRequest(msg);
  } else if (msg.body.toLowerCase().startsWith('/horarios')) {
    handleAvailabilityRequest(msg);
  } else if (msg.body.toLowerCase().startsWith('/ajuda')) {
    msg.reply(`*Comandos disponíveis:*
🗓️ /agendar - Iniciar agendamento
⏰ /horarios - Ver horários disponíveis
❓ /ajuda - Ver esta mensagem de ajuda`);
  }
});

// Função para lidar com solicitações de agendamento
async function handleSchedulingRequest(msg) {
  try {
    // Verificar se o cliente já existe
    const phone = msg.from.replace('@c.us', '');
    
    db.get('SELECT * FROM clients WHERE phone = ?', [phone], async (err, client) => {
      if (err) {
        console.error('Erro ao buscar cliente:', err);
        msg.reply('Desculpe, ocorreu um erro ao processar sua solicitação.');
        return;
      }
      
      if (!client) {
        msg.reply(`Olá! Parece que é sua primeira vez aqui. 
Por favor, me informe seu nome completo para continuar com o agendamento.`);
        return;
      }
      
      // Buscar profissionais disponíveis
      db.all('SELECT * FROM professionals WHERE active = 1', [], async (err, professionals) => {
        if (err || !professionals.length) {
          msg.reply('Desculpe, não há profissionais disponíveis no momento.');
          return;
        }
        
        let response = '*Profissionais disponíveis:*\n\n';
        professionals.forEach((prof, index) => {
          response += `${index + 1}. ${prof.name} - ${prof.specialty}\n`;
        });
        
        response += '\nPara agendar, responda com o número do profissional desejado.';
        msg.reply(response);
      });
    });
  } catch (error) {
    console.error('Erro ao processar agendamento:', error);
    msg.reply('Desculpe, ocorreu um erro ao processar sua solicitação.');
  }
}

// Função para lidar com solicitações de horários disponíveis
async function handleAvailabilityRequest(msg) {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay();
    
    db.all(`
      SELECT p.name, p.specialty, a.* 
      FROM professionals p 
      JOIN availability a ON p.id = a.professional_id 
      WHERE p.active = 1 AND a.day_of_week = ?
    `, [dayOfWeek], async (err, availability) => {
      if (err || !availability.length) {
        msg.reply('Desculpe, não há horários disponíveis para hoje.');
        return;
      }
      
      let response = '*Horários disponíveis hoje:*\n\n';
      availability.forEach(slot => {
        response += `*${slot.name} - ${slot.specialty}*\n`;
        response += `⏰ ${slot.start_time} às ${slot.end_time}\n\n`;
      });
      
      response += 'Para agendar, use o comando /agendar';
      msg.reply(response);
    });
  } catch (error) {
    console.error('Erro ao buscar horários:', error);
    msg.reply('Desculpe, ocorreu um erro ao buscar os horários disponíveis.');
  }
}

// Rota para iniciar o cliente WhatsApp
app.post('/api/admin/whatsapp/start', requireAdmin, (req, res) => {
  try {
    client.initialize();
    res.json({ message: 'Cliente WhatsApp iniciado' });
  } catch (error) {
    console.error('Erro ao iniciar cliente WhatsApp:', error);
    res.status(500).json({ error: 'Erro ao iniciar cliente WhatsApp' });
  }
});

// Rota para parar o cliente WhatsApp
app.post('/api/admin/whatsapp/stop', requireAdmin, (req, res) => {
  try {
    client.destroy();
    res.json({ message: 'Cliente WhatsApp parado' });
  } catch (error) {
    console.error('Erro ao parar cliente WhatsApp:', error);
    res.status(500).json({ error: 'Erro ao parar cliente WhatsApp' });
  }
});

// Rota para obter status do WhatsApp
app.get('/api/admin/whatsapp/status', requireAdmin, (req, res) => {
  try {
    const status = client.info ? 'connected' : 'disconnected';
    res.json({ status });
  } catch (error) {
    console.error('Erro ao obter status do WhatsApp:', error);
    res.status(500).json({ error: 'Erro ao obter status do WhatsApp' });
  }
});

// Rota para gerenciar disponibilidade de profissionais
app.post('/api/admin/professionals/:id/availability', requireAdmin, (req, res) => {
  const { id } = req.params;
  const { dayOfWeek, startTime, endTime, slotDuration } = req.body;
  
  if (!dayOfWeek || !startTime || !endTime || !slotDuration) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  db.run(`
    INSERT INTO availability (professional_id, day_of_week, start_time, end_time, slot_duration)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(professional_id, day_of_week, start_time, end_time) 
    DO UPDATE SET slot_duration = ?
  `, [id, dayOfWeek, startTime, endTime, slotDuration, slotDuration], function(err) {
    if (err) {
      console.error('Erro ao salvar disponibilidade:', err);
      return res.status(500).json({ error: 'Erro ao salvar disponibilidade' });
    }
    res.json({ message: 'Disponibilidade atualizada com sucesso' });
  });
});

// Rota para listar disponibilidade de profissionais
app.get('/api/admin/professionals/:id/availability', requireAdmin, (req, res) => {
  const { id } = req.params;
  
  db.all('SELECT * FROM availability WHERE professional_id = ? ORDER BY day_of_week, start_time', [id], (err, rows) => {
    if (err) {
      console.error('Erro ao buscar disponibilidade:', err);
      return res.status(500).json({ error: 'Erro ao buscar disponibilidade' });
    }
    res.json(rows);
  });
});

// Configuração do Socket.IO
io.on('connection', (socket) => {
  console.log('Cliente conectado');
  
  socket.on('disconnect', () => {
    console.log('Cliente desconectado');
  });
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Diretório público: ${path.join(__dirname, 'public')}`);
  client.initialize().catch(err => {
    console.error('Erro ao inicializar WhatsApp:', err);
  });
});

// Inicialização do banco de dados
function initializeDatabase() {
  console.log('\n=== Inicializando banco de dados ===');

  // Tabela de administradores
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Erro ao criar tabela admins:', err);
      return;
    }
    console.log('Tabela admins criada ou já existente');
    
    // Inserir admin padrão se não existir
    const adminEmail = 'admin@agendai.com';
    db.get('SELECT id FROM admins WHERE email = ?', [adminEmail], (err, row) => {
      if (err) {
        console.error('Erro ao verificar admin:', err);
        return;
      }
      if (!row) {
        bcrypt.hash('admin123', 10, (err, hash) => {
          if (err) {
            console.error('Erro ao criar hash da senha:', err);
            return;
          }
          db.run('INSERT INTO admins (name, email, password) VALUES (?, ?, ?)',
            ['Administrador', adminEmail, hash]);
        });
      }
    });
  });

  // Tabela de profissionais
  db.serialize(() => {
    // Remover tabela antiga se existir
    db.run(`DROP TABLE IF EXISTS professionals`, (err) => {
      if (err) {
        console.error('Erro ao remover tabela professionals:', err);
        return;
      }
      console.log('Tabela professionals removida');
      
      // Criar nova tabela
      db.run(`CREATE TABLE professionals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        specialty TEXT NOT NULL,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          console.error('Erro ao criar tabela professionals:', err);
          return;
        }
        console.log('Tabela professionals criada');
        
        // Inserir profissional de teste
        db.run('INSERT INTO professionals (name, email, phone, specialty) VALUES (?, ?, ?, ?)',
          ['João Silva', 'joao.silva@exemplo.com', '11999999999', 'Dentista'], (err) => {
            if (err) {
              console.error('Erro ao inserir profissional de teste:', err);
              return;
            }
            console.log('Profissional de teste inserido');
          });
      });
    });
  });

  // Tabela de disponibilidade dos profissionais
  db.run(`CREATE TABLE IF NOT EXISTS availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    professional_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0 = Domingo, 1 = Segunda, etc
    start_time TEXT NOT NULL,     -- Formato HH:MM
    end_time TEXT NOT NULL,       -- Formato HH:MM
    slot_duration INTEGER NOT NULL, -- Duração em minutos
    FOREIGN KEY (professional_id) REFERENCES professionals(id),
    UNIQUE(professional_id, day_of_week, start_time, end_time)
  )`, (err) => {
    if (err) {
      console.error('Erro ao criar tabela availability:', err);
      return;
    }
    console.log('Tabela availability criada ou já existente');
  });

  // Tabela de clientes
  db.run(`CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Erro ao criar tabela clients:', err);
      return;
    }
    console.log('Tabela clients criada ou já existente');
  });

  // Tabela de agendamentos
  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    professional_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (professional_id) REFERENCES professionals(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
  )`, (err) => {
    if (err) {
      console.error('Erro ao criar tabela appointments:', err);
      return;
    }
    console.log('Tabela appointments criada ou já existente');
  });

  // Tabela de configurações
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`, (err) => {
    if (err) {
      console.error('Erro ao criar tabela settings:', err);
      return;
    }
    console.log('Tabela settings criada ou já existente');
  });
}
