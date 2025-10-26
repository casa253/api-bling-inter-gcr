import express from 'express';
import nodeFetch from 'node-fetch'; 
import https from 'https'; // Módulo nativo para mTLS
import { KEYUTIL, X509 } from 'jsrsasign'; // Bibliotecas para P12 (necessário no package.json)

const app = express();
const PORT = process.env.PORT || 8080;

// =========================================================
// CRUCIAL: MIDDLEWARE PARA PARSING DO CORPO DA REQUISIÇÃO (BODY)
// =========================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Variáveis de ambiente (Serão injetadas pelo Cloud Run)
const P12_PASSWORD = process.env.P12_PASSWORD;
const P12_BASE64 = process.env.P12_BASE64;
const INTER_CLIENT_ID = process.env.INTER_CLIENT_ID; 
const INTER_CLIENT_SECRET = process.env.INTER_CLIENT_SECRET;
const SCOPE = process.env.SCOPE; 
const INTER_TOKEN_URL = process.env.INTER_TOKEN_URL; 

// =========================================================
// FUNÇÃO DE PROCESSAMENTO P12 (MANTIDA, MAS NÃO SERÁ CHAMADA POR ENQUANTO)
// =========================================================

/**
 * Processa o certificado P12 em Base64 e retorna a chave privada e o certificado em formato PEM.
 * @param {string} p12Base64 - Certificado codificado em Base64.
 * @param {string} p12Password - Senha do certificado.
 * @returns {{privateKey: string, certificate: string}} PEM key and certificate.
 */
const getCertKeyFromP12 = (p12Base64, p12Password) => {
    // Log para confirmar que a função P12 foi iniciada
    console.log("LOG P12: Iniciando processamento interno do certificado...");
    
    if (!p12Base64 || !p12Password) {
        // Se as credenciais estiverem faltando, lança um erro, mas não trava.
        throw new Error("Credenciais P12 (Base64/Senha) não configuradas no ambiente.");
    }
    
    // Log para verificar o tamanho da string Base64 (deve ser grande)
    console.log(`LOG P12: P12_BASE64 Length: ${p12Base64.length}`);

    // Conversão de Base64 para binário (DER)
    const p12Der = Buffer.from(p12Base64, 'base64').toString('binary');
    const p12Hex = Buffer.from(p12Der, 'binary').toString('hex');

    // Analisa o P12 com a biblioteca jsrsasign (Esta é a operação mais pesada e síncrona)
    const p12Data = KEYUTIL.parsePKCS12(p12Hex, p12Password);
    
    const p12Key = p12Data.key;
    const p12Cert = p12Data.certs[0];

    // Converte para o formato PEM
    const privateKey = KEYUTIL.getPEM(p12Key, "PKCS8PRV");
    const certificate = X509.pem(p12Cert);
    
    // Log para confirmar que a função P12 foi concluída
    console.log("LOG P12: Processamento interno do certificado concluído com sucesso.");
    
    return { privateKey, certificate };
}

// ---------------------------------------------------------
// ROTA PRINCIPAL: Recebe o POST do Bling/Webhook
// ---------------------------------------------------------
app.post('/', async (req, res) => {
    
    // Log CRÍTICO para confirmar que o servidor recebeu a requisição
    console.log('LOG POST: Servidor recebeu a requisição POST com sucesso.');
    
    // Variáveis que armazenarão a chave e o certificado PEM
    let mTLSCredentials;
    
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
        
        // ==================================================================
        // ⚠️ ATENÇÃO: BLOCO P12 DESATIVADO PARA TESTE DE LIVENESS ⚠️
        // Se o Postman responder AGORA, o problema é 100% o processamento P12.
        // ==================================================================
        /*
        console.log("LOG POST: Iniciando bloco try/catch para processamento P12...");
        try {
            mTLSCredentials = getCertKeyFromP12(P12_BASE64, P12_PASSWORD);
            console.log("LOG POST: Sucesso ao processar P12. Iniciando requisição mTLS.");
        } catch (p12Error) {
             console.error("LOG POST: ERRO P12/mTLS (Catch Block):", p12Error.message);
             return res.status(403).json({
                 status: 'Falha de Autenticação mTLS',
                 message: 'Falha ao processar o certificado P12 (Base64 ou Senha incorretos).',
                 detail: p12Error.message
             });
        }
        */
        // ==================================================================
        
        // 3. LÓGICA DE REQUISIÇÃO PARA O INTER (TOKEN)
        // O código de solicitação do token M-TLS será colocado aqui.
        
        // 4. Resposta de Sucesso
        console.log("LOG POST: Respondendo com 200 (Sucesso provisório - Lógica P12 desativada).");
        res.status(200).json({ 
            status: 'Sucesso', 
            message: 'Requisição processada com sucesso. Servidor OK.',
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