import express from 'express';
// import nodeFetch from 'node-fetch'; // Removido para teste
// import https from 'https'; // Removido para teste
// import { KEYUTIL, X509 } from 'jsrsasign'; // Removido para teste

const app = express();
const PORT = process.env.PORT || 8080;

// =========================================================
// CRUCIAL: MIDDLEWARE PARA PARSING DO CORPO DA REQUISIÇÃO (BODY)
// =========================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Variáveis de ambiente (Ainda declaradas, mas não usadas)
const P12_PASSWORD = process.env.P12_PASSWORD;
const P12_BASE64 = process.env.P12_BASE64;
const INTER_CLIENT_ID = process.env.INTER_CLIENT_ID; 
const INTER_CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const SCOPE = process.env.SCOPE; 
const INTER_TOKEN_URL = process.env.INTER_TOKEN_URL; 

// =========================================================
// FUNÇÃO DE PROCESSAMENTO P12 REMOVIDA
// =========================================================


// ---------------------------------------------------------
// ROTA PRINCIPAL: Recebe o POST do Bling/Webhook
// ---------------------------------------------------------
app.post('/', async (req, res) => {
    
    // Log CRÍTICO para confirmar que o servidor recebeu a requisição
    console.log('LOG POST: Servidor recebeu a requisição POST com sucesso.');
    
    try {
        const payload = req.body;
        console.log('LOG POST: Payload recebido:', JSON.stringify(payload, null, 2));
        
        // 2. Lógica de Validação
        if (!payload || Object.keys(payload).length === 0) {
            // Se o payload for inválido, responde com 400.
            return res.status(400).json({ 
                status: 'Erro de Requisição', 
                message: 'Corpo da requisição vazio. Esperando o payload do Bling.' 
            });
        }
        
        // 3. Resposta de Sucesso (Imediata)
        console.log("LOG POST: Respondendo com 200 (Teste de Liveness - Mínimo).");
        res.status(200).json({ 
            status: 'Sucesso', 
            message: 'Requisição processada com sucesso. Servidor OK (Teste de Liveness).',
            payloadEcho: payload 
        });

    } catch (error) {
        console.error('LOG POST: Erro fatal durante o processamento da requisição:', error.message);
        res.status(500).json({ 
            status: 'Erro Interno do Servidor', 
            error: error.message 
        });
    }
});

// ---------------------------------------------------------
// ROTA GET / (Para confirmar que o serviço está ativo)
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
