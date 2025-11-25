import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import { useAuth } from '../context/AuthContext';
import { processCommandWithAI, confirmAction } from '../services/openai';
import { Send, Bot, User, AlertTriangle, Check, X } from 'lucide-react';
import clsx from 'clsx';

const PromptManager = () => {
    const { queryUsers } = useUser(); // Only need queryUsers for local filtering
    const { user, getAuthHeaders } = useAuth();
    const [messages, setMessages] = useState([
        { id: 1, type: 'bot', text: 'Olá! Sou seu assistente de gestão. Você pode pedir para cadastrar usuários, consultar dados ou realizar ações em massa.' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        if (!inputValue.trim()) return;

        const userText = inputValue.trim();
        setMessages(prev => [...prev, { id: Date.now(), type: 'user', text: userText }]);
        setInputValue('');

        // Process command via backend
        setTimeout(() => {
            processCommand(userText);
        }, 500);
    };

    const processCommand = async (text) => {
        try {
            // Criar headers de autenticação
            const authHeaders = user && user.id ? { 'x-user-id': user.id.toString() } : {};
            const response = await processCommandWithAI(text, authHeaders);

            if (response.type === 'TEXT') {
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'bot',
                    text: response.content
                }]);
            }
            else if (response.type === 'ACTION_COMPLETE') {
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'bot',
                    text: response.message
                }]);
                // User will see the success message in chat
            }
            else if (response.type === 'CONFIRMATION_REQUIRED') {
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'bot',
                    isConfirmation: true,
                    text: response.message,
                    confirmationToken: response.confirmationToken,
                    affectedCount: response.affectedCount
                }]);
            }
            else if (response.type === 'ERROR') {
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'bot',
                    text: `Erro: ${response.message}`
                }]);
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                id: Date.now(),
                type: 'bot',
                text: 'Erro ao processar comando.'
            }]);
        }
    };

    const handleConfirm = async (token) => {
        try {
            // Criar headers de autenticação
            const authHeaders = user && user.id ? { 'x-user-id': user.id.toString() } : {};
            const response = await confirmAction(token, authHeaders);

            setMessages(prev => [...prev, {
                id: Date.now(),
                type: 'bot',
                text: response.message
            }]);

            // Refresh user list
            // User will see the confirmation result in chat
        } catch (error) {
            setMessages(prev => [...prev, {
                id: Date.now(),
                type: 'bot',
                text: 'Erro ao confirmar ação.'
            }]);
        }
    };

    const handleCancel = () => {
        setMessages(prev => [...prev, {
            id: Date.now(),
            type: 'bot',
            text: 'Ação cancelada.'
        }]);
    };

    return (
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Bot size={20} />
                    </div>
                    <div>
                        <h2 className="font-semibold text-slate-800">Assistente de Gestão</h2>
                        <p className="text-xs text-slate-500">Processamento via OpenAI (Backend)</p>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30">
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        className={clsx(
                            'flex gap-4 max-w-3xl',
                            msg.type === 'user' ? 'ml-auto flex-row-reverse' : ''
                        )}
                    >
                        <div className={clsx(
                            'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                            msg.type === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-blue-600 text-white'
                        )}>
                            {msg.type === 'user' ? <User size={16} /> : <Bot size={16} />}
                        </div>

                        <div className={clsx(
                            'p-4 rounded-2xl shadow-sm text-sm leading-relaxed',
                            msg.type === 'user'
                                ? 'bg-slate-800 text-white rounded-tr-none'
                                : msg.isConfirmation
                                    ? 'bg-amber-50 border border-amber-200 text-amber-900 rounded-tl-none'
                                    : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                        )}>
                            {msg.isConfirmation && (
                                <div className="flex items-center gap-2 mb-3 text-amber-600 font-bold uppercase text-xs tracking-wider">
                                    <AlertTriangle size={14} />
                                    Confirmação Necessária
                                </div>
                            )}
                            <p className="mb-3">{msg.text}</p>

                            {msg.isConfirmation && (
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => handleConfirm(msg.confirmationToken)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                    >
                                        <Check size={16} />
                                        Sim, confirmar
                                    </button>
                                    <button
                                        onClick={handleCancel}
                                        className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition-colors text-sm font-medium"
                                    >
                                        <X size={16} />
                                        Cancelar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100">
                <div className="max-w-4xl mx-auto relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Digite um comando (ex: 'Cadastrar Ana, perfil Master, empresa TechCorp')"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!inputValue.trim()}
                        className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <Send size={20} />
                    </button>
                </div>
                <p className="text-center text-xs text-slate-400 mt-3">
                    Pressione Enter para enviar. Comandos disponíveis: Cadastrar, Bloquear, Consultar.
                </p>
            </div>
        </div>
    );
};

export default PromptManager;
