const NORMALIZE_REGEX = /[\n\r]+/g;

const PROMPT_INJECTION_PATTERNS = [
    /ignore\s+all\s+previous\s+instructions/i,
    /forget\s+your\s+rules/i,
    /desconsidere\s+as\s+regras/i,
    /can you tell me the system prompt/i,
    /reveal\s+(the\s+)?(system|hidden)\s+(prompt|instructions)/i,
    /execute\s+comandos?\s+sql/i,
    /liste?\s+todo\s+o\s+conteúdo\s+do\s+banco/i
];

const SENSITIVE_REQUEST_PATTERNS = [
    /\bdump\b.*\b(bd|db|database)/i,
    /\bddl\b/i,
    /create\s+table/i,
    /senha[s]?/i,
    /passwords?/i,
    /hash\s+de\s+senha/i
];

const SENSITIVE_OUTPUT_PATTERNS = [
    {
        regex: /(senha\s*[:=]\s*)(\S+)/gi,
        replacement: '$1[REDACTED]'
    },
    {
        regex: /(password\s*[:=]\s*)(\S+)/gi,
        replacement: '$1[REDACTED]'
    },
    {
        regex: /(create\s+table[\s\S]+?;)/gi,
        replacement: '[DDL REMOVIDO]'
    }
];

function sanitizeUserMessage(message) {
    if (!message || typeof message !== 'string') {
        return {
            sanitizedMessage: '',
            blocked: true,
            userFeedback: 'Não entendi a solicitação. Pode reformular?'
        };
    }

    const normalized = message.replace(NORMALIZE_REGEX, '\n').trim();

    if (PROMPT_INJECTION_PATTERNS.some(pattern => pattern.test(normalized))) {
        return {
            sanitizedMessage: '',
            blocked: true,
            userFeedback: 'Não posso executar essa instrução. Por favor, mantenha o pedido dentro das regras de segurança.'
        };
    }

    if (SENSITIVE_REQUEST_PATTERNS.some(pattern => pattern.test(normalized))) {
        return {
            sanitizedMessage: '',
            blocked: true,
            userFeedback: 'Não posso divulgar estruturas, DDLs ou senhas do banco de dados.'
        };
    }

    const sanitizedMessage = normalized.replace(/senha\s+([^\s]+)/gi, 'senha [REDACTED]');

    return {
        sanitizedMessage,
        blocked: false
    };
}

function redactSensitiveOutput(text = '') {
    if (!text) {
        return text;
    }

    return SENSITIVE_OUTPUT_PATTERNS.reduce(
        (acc, pattern) => acc.replace(pattern.regex, pattern.replacement),
        text
    );
}

module.exports = {
    sanitizeUserMessage,
    redactSensitiveOutput
};

