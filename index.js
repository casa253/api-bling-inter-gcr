import express from 'express';
import nodeFetch from 'node-fetch'; // Certifique-se de que 'node-fetch' está no package.json

const app = express();
const PORT = process.env.PORT || 8080;

// =========================================================
// CRUCIAL: MIDDLEWARE PARA PARSING DO CORPO DA REQUISIÇÃO (BODY)
// Se faltar isso, o Postman trava ao enviar JSON/Form-data!
// =========================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Variáveis de ambiente (Serão injetadas pelo Cloud Run)
const P12_PASSWORD = process.env.P12_PASSWORD;
const P12_BASE64 = process.env.P12_BASE64;
// Adicione outras variáveis aqui conforme necessário

// ---------------------------------------------------------
// ROTA PRINCIPAL: Recebe o POST do Bling/Webhook
// ---------------------------------------------------------
app.post('/', async (req, res) => {
    try {
        console.log('Requisição POST recebida.');

        // 1. Loga o corpo recebido (o payload do webhook)
        // Isso confirma que o express.json() está funcionando
        const payload = req.body;
        console.log('Payload recebido:', JSON.stringify(payload, null, 2));
        
        // 2. Lógica de Validação (Exemplo)
        if (!payload || Object.keys(payload).length === 0) {
             // Responde imediatamente para evitar travamento se o corpo estiver vazio
            return res.status(400).json({ 
                status: 'Erro de Requisição', 
                message: 'Corpo da requisição vazio. O Bling não enviou o payload esperado.' 
            });
        }
        
        // --- COLOCAR AQUI A LÓGICA DE GERAÇÃO DO TOKEN E ENVIO PARA O INTER ---
        // Exemplo:
        // const interResponse = await enviarParaInter(payload, P12_BASE64, P12_PASSWORD);

        // 3. Resposta de Sucesso (Crucial: SEMPRE responda para evitar timeout)
        // O webhook do Bling espera um status HTTP 200 para considerar a entrega bem-sucedida.
        res.status(200).json({ 
            status: 'Sucesso', 
            message: 'Requisição processada com sucesso. Resposta do Inter enviada.',
            payloadEcho: payload 
        });

    } catch (error) {
        console.error('Erro durante o processamento da requisição:', error.message);
        // Resposta de erro para garantir que o Bling não reenvie a requisição
        res.status(500).json({ 
            status: 'Erro Interno do Servidor', 
            error: error.message 
        });
    }
});

// ---------------------------------------------------------
// ROTA GET / (Apenas para confirmar que o serviço está ativo)
// ---------------------------------------------------------
app.get('/', (req, res) => {
    res.status(200).json({ 
        status: 'Online', 
        message: 'Webhook para Bling/Inter está ativo e pronto para receber POSTs.',
        docs: 'Acesse o / endpoint usando o método POST com o payload do webhook do Bling.' 
    });
});

// ---------------------------------------------------------
// INICIALIZAÇÃO DO SERVIDOR
// ---------------------------------------------------------
app.listen(PORT, () => {
    console.log(`Servidor Node.js rodando na porta ${PORT}`);
});
