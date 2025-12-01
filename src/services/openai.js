// Frontend service - calls backend /api/chat instead of OpenAI directly
export const processCommandWithAI = async (text, authHeaders = {}, conversationHistory = []) => {
    try {
        console.log('[API] processCommandWithAI chamado com authHeaders:', authHeaders);
        console.log('[API] Tipo de authHeaders:', typeof authHeaders, 'É objeto?', authHeaders instanceof Object);
        console.log('[API] authHeaders tem x-user-id?', 'x-user-id' in authHeaders, 'Valor:', authHeaders['x-user-id']);
        console.log('[API] Histórico de conversa:', conversationHistory.length, 'mensagens');
        
        // FALLBACK: Se não tiver x-user-id, tentar recuperar do localStorage
        if (!authHeaders || !authHeaders['x-user-id']) {
            console.warn('[API] x-user-id não encontrado nos headers, tentando recuperar do localStorage...');
            try {
                const savedUser = localStorage.getItem('user');
                if (savedUser) {
                    const parsedUser = JSON.parse(savedUser);
                    if (parsedUser && parsedUser.id) {
                        console.log('[API] Usuário encontrado no localStorage, adicionando x-user-id:', parsedUser.id);
                        authHeaders = {
                            ...authHeaders,
                            'x-user-id': parsedUser.id.toString()
                        };
                    }
                }
            } catch (error) {
                console.error('[API] Erro ao recuperar usuário do localStorage:', error);
            }
        }
        
        const headers = { 
            'Content-Type': 'application/json',
            ...authHeaders
        };
        
        console.log('[API] Headers finais antes do fetch:', headers);
        
        // Debug: log headers sendo enviados
        if (authHeaders['x-user-id']) {
            console.log('[API] Enviando requisição com x-user-id:', authHeaders['x-user-id']);
        } else {
            console.warn('[API] ATENÇÃO: x-user-id não está sendo enviado!', {
                authHeaders,
                hasXUserId: 'x-user-id' in authHeaders,
                keys: Object.keys(authHeaders),
                values: Object.values(authHeaders)
            });
        }
        
        const requestBody = { 
            message: text,
            history: conversationHistory
        };
        console.log('[API] Enviando requisição com histórico:', {
            messageLength: text.length,
            historyLength: conversationHistory.length,
            lastHistoryMessages: conversationHistory.slice(-2).map(m => `${m.role}: ${m.content?.substring(0, 30)}...`)
        });
        
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: 'API request failed' }));
            const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: API request failed`;
            
            // Se for erro 401, fornecer mensagem mais clara
            if (response.status === 401) {
                throw new Error('Autenticação necessária. Faça login novamente.');
            }
            
            throw new Error(errorMessage);
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("API Error:", error);
        return { type: 'ERROR', message: error.message };
    }
};

export const confirmAction = async (confirmationToken, authHeaders = {}) => {
    try {
        const response = await fetch('/api/action/confirm', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                ...authHeaders
            },
            body: JSON.stringify({ confirmationToken })
        });

        if (!response.ok) {
            throw new Error('Confirmation failed');
        }

        const data = await response.json();
        return data;

    } catch (error) {
        console.error("Confirmation Error:", error);
        return { type: 'ERROR', message: error.message };
    }
};
