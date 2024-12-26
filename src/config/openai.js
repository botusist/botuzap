const { Configuration, OpenAIApi } = require('openai');
require('dotenv').config();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

async function generateResponse(message, context) {
  try {
    const completion = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { 
          role: "system", 
          content: process.env.SYSTEM_PROMPT
            .replace('{assistant_name}', context.assistant_name)
            .replace('{company_name}', context.company_name)
            .replace('{business_hours}', context.business_hours)
            .replace('{service_duration}', context.service_duration)
            .replace('{professionals_list}', context.professionals_list)
        },
        { role: "user", content: message }
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    return completion.data.choices[0].message.content;
  } catch (error) {
    console.error('Erro ao gerar resposta:', error);
    throw error;
  }
}

async function transcribeAudio(audioBuffer) {
  try {
    const response = await openai.createTranscription(
      audioBuffer,
      "whisper-1"
    );
    return response.data.text;
  } catch (error) {
    console.error('Erro ao transcrever áudio:', error);
    throw error;
  }
}

async function analyzeImage(imageBuffer) {
  try {
    const response = await openai.createImageAnalysis({
      image: imageBuffer,
      model: "gpt-4-vision-preview",
      max_tokens: 300
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('Erro ao analisar imagem:', error);
    throw error;
  }
}

module.exports = {
  generateResponse,
  transcribeAudio,
  analyzeImage
};
