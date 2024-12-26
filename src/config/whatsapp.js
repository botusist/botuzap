const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { generateResponse, transcribeAudio, analyzeImage } = require('./openai');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

class WhatsAppBot {
  constructor() {
    this.client = null;
    this.sessionData = {};
  }

  async initialize() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: ['--no-sandbox']
      }
    });

    this.client.on('qr', (qr) => {
      // Gerar QR code no terminal
      qrcode.generate(qr, { small: true });
      console.log('QR Code gerado! Escaneie para conectar.');
    });

    this.client.on('ready', () => {
      console.log('Cliente WhatsApp conectado e pronto!');
    });

    this.client.on('message', async (message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        console.error('Erro ao processar mensagem:', error);
        await message.reply('Desculpe, ocorreu um erro ao processar sua mensagem. Por favor, tente novamente.');
      }
    });

    await this.client.initialize();
  }

  async handleMessage(message) {
    const sender = message.from;
    const context = await this.getContext();

    // Inicializar ou recuperar sessão do usuário
    if (!this.sessionData[sender]) {
      this.sessionData[sender] = {
        step: 'initial',
        data: {}
      };
    }

    let userInput;

    // Processar diferentes tipos de mensagem
    if (message.hasMedia) {
      const media = await message.downloadMedia();
      const buffer = Buffer.from(media.data, 'base64');

      if (media.mimetype.startsWith('audio')) {
        userInput = await transcribeAudio(buffer);
      } else if (media.mimetype.startsWith('image')) {
        userInput = await analyzeImage(buffer);
      }
    } else {
      userInput = message.body;
    }

    // Gerar resposta com base no contexto atual
    const response = await generateResponse(userInput, context);

    // Processar resposta da IA e extrair informações de agendamento
    const schedulingInfo = this.extractSchedulingInfo(response);
    if (schedulingInfo) {
      await this.processScheduling(sender, schedulingInfo);
    }

    // Enviar resposta ao usuário
    await message.reply(response);
  }

  async getContext() {
    // Buscar informações do banco de dados
    const settings = await prisma.settings.findFirst();
    const professionals = await prisma.professional.findMany({
      where: { active: true }
    });

    return {
      assistant_name: settings.botName,
      company_name: settings.companyName,
      business_hours: settings.businessHours,
      service_duration: settings.serviceDuration,
      professionals_list: professionals.map(p => p.name).join(', ')
    };
  }

  extractSchedulingInfo(response) {
    // Implementar lógica para extrair informações de agendamento da resposta
    const schedulingRegex = /Agendamento:\s*Profissional:\s*(.+?)\s*Data:\s*(.+?)\s*Horário:\s*(.+?)\s*Cliente:\s*(.+?)(\s|$)/i;
    const match = response.match(schedulingRegex);

    if (match) {
      return {
        professional: match[1],
        date: match[2],
        time: match[3],
        clientName: match[4]
      };
    }

    return null;
  }

  async processScheduling(sender, schedulingInfo) {
    try {
      // Criar ou atualizar cliente
      const client = await prisma.client.upsert({
        where: { phone: sender },
        update: { name: schedulingInfo.clientName },
        create: {
          phone: sender,
          name: schedulingInfo.clientName
        }
      });

      // Criar agendamento
      const appointment = await prisma.appointment.create({
        data: {
          clientId: client.id,
          professionalId: schedulingInfo.professional,
          date: new Date(schedulingInfo.date + ' ' + schedulingInfo.time),
          status: 'SCHEDULED'
        }
      });

      return appointment;
    } catch (error) {
      console.error('Erro ao processar agendamento:', error);
      throw error;
    }
  }
}

module.exports = new WhatsAppBot();
