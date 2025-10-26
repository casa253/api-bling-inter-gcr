import express from 'express';
import nodeFetch from 'node-fetch'; 
import { getCertKeyFromP12 } from './p12-processor.js'; // Novo arquivo de processamento P12
import https from 'https'; // Módulo nativo para mTLS
import url from 'url'; // Módulo nativo
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
// FUNÇÃO DE PROCESSAMENTO P12 (MOVIDA PARA DENTRO DO ARQUIVO POR SIMPLICIDADE)
// =========================================================

/**
 * Processa o certificado P12 em Base64 e retorna a chave privada e o certificado em formato PEM.
 * @param {string} p12Base64 - Certificado codificado em Base64.
 * @param {string} p12Password - Senha do certificado.
 * @returns {{privateKey: string, certificate: string}} PEM key and certificate.
 */
function getCertKeyFromP12(p12Base64, p12Password) {
    if (!p12Base64 || !p12Password) {
        throw new Error("Credenciais P12 (Base64/Senha) não configuradas no ambiente.");
    }

    const p12Der = Buffer.from(p12Base64, 'base64').toString('binary');
    const p12Hex = Buffer.from(p12Der, 'binary').toString('hex');

    // Analisa o P12 com a biblioteca jsrsasign
    const p12Data = KEYUTIL.parsePKCS12(p12Hex, p12Password);
    
    const p12Key = p12Data.key;
    const p12Cert = p12Data.certs[0];

    // Converte para o formato PEM, necessário para o mTLS
    const privateKey = KEYUTIL.getPEM(p12Key, "PKCS8PRV");
    const certificate = X509.pem(p12Cert);
    
    return { privateKey, certificate };
}

// ---------------------------------------------------------
// ROTA PRINCIPAL: Recebe o POST do Bling/Webhook
// ---------------------------------------------------------
app.post('/', async (req, res) => {
    
    // Variáveis que armazenarão a chave e o certificado PEM
    let mTLSCredentials;
    
    try {
        console.log('Requisição POST recebida.');

        const payload = req.body;
        console.log('Payload recebido:', JSON.stringify(payload, null, 2));
        
        // 2. Lógica de Validação
        if (!payload || Object.keys(payload).length === 0) {
            return res.status(400).json({ 
                status: 'Erro de Requisição', 
                message: 'Corpo da requisição vazio. Esperando o payload do Bling.' 
            });
        }
        
        // ------------------------------------------------------------------
        // NOVO PASSO: Extrair Chave/Certificado P12.
        // Se a requisição travar, o erro deve estar aqui.
        // ------------------------------------------------------------------
        try {
            mTLSCredentials = getCertKeyFromP12(P12_BASE64, P12_PASSWORD);
            console.log("Sucesso ao processar P12. Iniciando requisição mTLS.");
        } catch (p12Error) {
             console.error("ERRO P12/mTLS:", p12Error.message);
             // Retorna um 403 se falhar, indicando que não podemos autenticar no Inter
             return res.status(403).json({
                 status: 'Falha de Autenticação mTLS',
                 message: 'Falha ao processar o certificado P12 (Base64 ou Senha incorretos).',
                 detail: p12Error.message
             });
        }
        
        // 3. LÓGICA DE REQUISIÇÃO PARA O INTER (TOKEN)
        // Isso deve ser feito em seguida, usando mTLSCredentials.privateKey e mTLSCredentials.certificate.
        
        // --- COLOCAR AQUI A LÓGICA DE GERAÇÃO DO TOKEN E ENVIO PARA O INTER ---
        // Exemplo:
        // const token = await solicitarTokenInter(mTLSCredentials);
        
        // 4. Resposta de Sucesso
        res.status(200).json({ 
            status: 'Sucesso', 
            message: 'Requisição processada com sucesso. Certificado P12 OK.',
            payloadEcho: payload 
        });

    } catch (error) {
        console.error('Erro durante o processamento da requisição:', error.message);
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