// Configuração do Servidor Express para Webhook mTLS com Banco Inter
import express from 'express';
import { Agent } from 'https';
import fetch from 'node-fetch';
import crypto from 'crypto';

// --- Variáveis de Ambiente ---
// O Cloud Run injeta a porta automaticamente.
const PORT = process.env.PORT || 8080; 

const P12_PASSWORD = process.env.P12_PASSWORD;
const P12_BASE64 = process.env.P12_BASE64;
const INTER_CLIENT_ID = process.env.INTER_CLIENT_ID;
const INTER_CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const SCOPE = process.env.SCOPE;
const INTER_TOKEN_URL = process.env.INTER_TOKEN_URL;

let httpsAgent;

/**
 * Função de inicialização que decodifica o certificado P12 e cria o agente HTTPS.
 * Esta função é crucial e deve ser executada apenas uma vez na inicialização.
 */
async function initializeMtlsAgent() {
    console.log("[DIAG] 1. Iniciando carregamento do Agente mTLS...");

    if (!P12_BASE64 || !P12_PASSWORD) {
        console.error("ERRO FATAL DE CONFIGURAÇÃO: P12_BASE64 ou P12_PASSWORD estão ausentes.");
        // Não lançamos um erro para o processo Node.js não travar, mas avisamos no log.
        return; 
    }

    try {
        // Decodificar o certificado P12 de Base64
        const p12Buffer = Buffer.from(P12_BASE64, 'base64');
        console.log(`[DIAG] 2. Certificado P12 decodificado para buffer. Tamanho: ${p12Buffer.length} bytes.`);

        // Configurar o agente HTTPS com o certificado P12 e a senha
        httpsAgent = new Agent({
            pfx: p12Buffer,
            passphrase: P12_PASSWORD,
            secureProtocol: 'TLSv1_2_method', // Especificar TLS 1.2 conforme exigido pelo Inter
            rejectUnauthorized: true, // Rejeitar certificados inválidos (boa prática)
        });
        
        console.log("[DIAG] 3. Agente mTLS configurado com sucesso. Pronto para obter token.");

    } catch (error) {
        console.error("ERRO FATAL NA INICIALIZAÇÃO DO mTLS: Falha ao decodificar ou configurar o certificado.", error);
        // Em caso de erro aqui, o processo Node.js provavelmente travará/reiniciará
        throw new Error("Falha na configuração do mTLS: " + error.message);
    }
}

// Inicializa o agente ANTES de iniciar o Express
initializeMtlsAgent(); 

// --- Configuração do Express ---
const app = express();

// Middleware para processar o corpo JSON e URL-encoded (o que o Bling envia)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rota de Health Check (GET /)
// Esta rota é crucial para testes e para verificar se o servidor está ativo.
app.get('/', (req, res) => {
    console.log("[LOG] Requisição GET na raiz. Servidor ativo.");
    res.status(200).send("Webhook para Bling/Inter está ativo e pronto para receber POSTs.");
});


// ROTA PRINCIPAL DO WEBHOOK (POST /)
app.post('/', async (req, res) => {
    console.log("[LOG] Recebido POST do Webhook. Processando...");
    
    // 1. Obter o corpo da requisição do Bling
    const blingData = req.body;
    
    // ** Diagnóstico: Verifique o que o Bling envia **
    if (Object.keys(blingData).length === 0) {
        console.warn("[LOG] Corpo da requisição POST está vazio. O Bling enviou dados?");
        // Resposta OK para não travar o Bling, mas sem processamento.
        return res.status(200).send({ status: "ok", message: "POST recebido, mas corpo estava vazio. Verifique a configuração do Bling." });
    }
    
    console.log(`[LOG] Dados recebidos. Tipo: ${blingData.evento} | ID: ${blingData.idRetorno}`);

    // --- Lógica de Criação do Token OAUTH 2.0 (Com mTLS) ---
    try {
        if (!httpsAgent) {
             console.error("[ERRO] Agente HTTPS não está inicializado. Falha de segurança.");
             return res.status(500).send({ error: "Servidor não configurado para mTLS.", details: "Certificado não carregado." });
        }
        
        console.log("[LOG] Tentando obter o token de acesso do Banco Inter...");

        const authString = Buffer.from(`${INTER_CLIENT_ID}:${INTER_CLIENT_SECRET}`).toString('base64');
        
        const tokenResponse = await fetch(INTER_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${authString}`,
            },
            agent: httpsAgent, // CRUCIAL: Uso do agente mTLS
            body: `grant_type=client_credentials&scope=${SCOPE}`
        });

        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
            console.error("[ERRO INTER] Falha ao obter token:", tokenData);
            return res.status(401).send({ error: "Falha de autenticação com o Banco Inter.", details: tokenData });
        }
        
        const accessToken = tokenData.access_token;
        console.log("[SUCESSO] Token de acesso obtido com sucesso.");

        // --- Aqui viria a LÓGICA DE CRIAÇÃO DE BOLETO (Não implementada neste exemplo) ---
        // Exemplo: const boletoResponse = await fetch('URL_BOLETO_INTER', { headers: { Authorization: `Bearer ${accessToken}` }... });
        
        // Simulação de resposta de sucesso após obter o token
        res.status(200).send({ 
            status: "ok", 
            message: "Token OAUTH obtido com sucesso. Processamento de boleto simulado.",
            inter_token_type: tokenData.token_type,
            inter_expires_in: tokenData.expires_in
        });

    } catch (error) {
        console.error("[ERRO INESPERADO] Erro durante a comunicação com o Inter ou processamento:", error);
        res.status(500).send({ 
            error: "Erro interno no servidor ao processar o webhook.", 
            details: error.message 
        });
    }
});

// --- Inicialização do Servidor ---
app.listen(PORT, () => {
    console.log(`[SUCESSO] Servidor Express iniciado e escutando na porta ${PORT}`);
});