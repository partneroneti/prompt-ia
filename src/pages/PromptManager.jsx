import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useAuth } from '../context/AuthContext';
import { processCommandWithAI, confirmAction } from '../services/openai';
import { Send, Bot, User, AlertTriangle, Check, X, FileText, Download, Search } from 'lucide-react';
import clsx from 'clsx';

const PromptManager = () => {
    const { queryUsers } = useUser(); // Only need queryUsers for local filtering
    const { user, getAuthHeaders } = useAuth();
    const [messages, setMessages] = useState([
        { id: 1, type: 'bot', text: 'Olá! Sou seu assistente de gestão. Você pode pedir para cadastrar usuários, consultar dados ou realizar ações em massa.' }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [previewData, setPreviewData] = useState(null);
    const navigate = useNavigate();
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
            else if (response.type === 'CUSTOM_REPORT_CREATED') {
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'bot',
                    text: response.message,
                    isCustomReport: true,
                    reportId: response.reportId,
                    reportName: response.reportName,
                    actions: response.actions
                }]);
                // Recarregar relatórios customizados na tela
                window.dispatchEvent(new CustomEvent('reloadCustomReports'));
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
            else if (response.type === 'REPORT_READY') {
                // Fazer download automático do relatório
                if (response.reportUrl) {
                    const link = document.createElement('a');
                    link.href = response.reportUrl;
                    link.download = `relatorio_${response.reportType}_${new Date().toISOString().split('T')[0]}.csv`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'bot',
                    text: response.message
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

            // Se for relatório, fazer download automático
            if (response.type === 'REPORT_READY' && response.reportUrl) {
                const link = document.createElement('a');
                link.href = response.reportUrl;
                link.download = `relatorio_${response.reportType}_${new Date().toISOString().split('T')[0]}.csv`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }

            setMessages(prev => [...prev, {
                id: Date.now(),
                type: 'bot',
                text: response.message || response.content || 'Ação confirmada com sucesso!'
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
        <div className="flex flex-col h-[calc(100vh-8rem)] bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden min-h-0">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center flex-shrink-0">
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
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/30 min-h-0">
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
                            {msg.isCustomReport && (
                                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <div className="text-sm font-semibold text-blue-900 mb-2">📊 {msg.reportName}</div>
                                    <div className="flex flex-wrap gap-2">
                                        <button
                                            onClick={() => {
                                                navigate(`/reports?type=${msg.reportId}`);
                                            }}
                                            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                        >
                                            <FileText size={12} />
                                            Ver na Tela
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const authHeaders = getAuthHeaders();
                                                    const response = await fetch(`/api/reports/preview`, {
                                                        method: 'POST',
                                                        headers: { 
                                                            'Content-Type': 'application/json',
                                                            ...authHeaders
                                                        },
                                                        body: JSON.stringify({ type: msg.reportId })
                                                    });
                                                    
                                                    if (!response.ok) {
                                                        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
                                                        throw new Error(errorData.error || errorData.message || 'Erro ao buscar preview');
                                                    }
                                                    
                                                    const data = await response.json();
                                                    if (data.rows && data.rows.length > 0) {
                                                        // Mostrar preview
                                                        setPreviewData({
                                                            columns: Object.keys(data.rows[0]),
                                                            rows: data.rows.slice(0, 10),
                                                            total: data.count
                                                        });
                                                    } else {
                                                        alert('Nenhum registro encontrado.');
                                                    }
                                                } catch (error) {
                                                    console.error('Erro ao visualizar:', error);
                                                    alert(`Erro ao visualizar relatório: ${error.message || 'Erro desconhecido'}`);
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs rounded-lg hover:bg-slate-200 transition-colors flex items-center gap-1"
                                        >
                                            <Search size={12} />
                                            Visualizar
                                        </button>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    const response = await fetch(`/api/reports/generate?type=${msg.reportId}`);
                                                    if (!response.ok) {
                                                        throw new Error('Erro ao gerar relatório');
                                                    }
                                                    const blob = await response.blob();
                                                    const url = window.URL.createObjectURL(blob);
                                                    const link = document.createElement('a');
                                                    link.href = url;
                                                    link.download = `relatorio_${msg.reportName || msg.reportId}_${new Date().toISOString().split('T')[0]}.csv`;
                                                    document.body.appendChild(link);
                                                    link.click();
                                                    window.URL.revokeObjectURL(url);
                                                    document.body.removeChild(link);
                                                } catch (error) {
                                                    console.error('Erro ao baixar:', error);
                                                    alert('Erro ao baixar CSV. Tente novamente.');
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
                                        >
                                            <Download size={12} />
                                            Baixar CSV
                                        </button>
                                    </div>
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
                
                {/* Preview Modal */}
                {previewData && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col">
                            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-slate-800">Preview do Relatório ({previewData.total} registros)</h3>
                                <button
                                    onClick={() => setPreviewData(null)}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-auto p-4">
                                <div className="bg-slate-900 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-700">
                                                {previewData.columns.map((col) => (
                                                    <th key={col} className="px-4 py-3 text-left font-medium text-slate-300 uppercase text-xs">
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.rows.map((row, idx) => (
                                                <tr key={idx} className="border-b border-slate-800 hover:bg-slate-800">
                                                    {previewData.columns.map((col) => (
                                                        <td key={col} className="px-4 py-3 text-slate-200">
                                                            {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {previewData.total > 10 && (
                                    <p className="text-sm text-slate-500 mt-2 text-center">
                                        Mostrando 10 de {previewData.total} registros. Acesse a tela de relatórios para ver todos.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Sempre visível */}
            <div className="p-4 bg-white border-t border-slate-100 flex-shrink-0 z-10">
                <div className="max-w-4xl mx-auto relative">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Digite um comando (ex: 'Cadastrar Ana, CPF 123.456.789-00, perfil Master, empresa TechCorp')"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                        autoFocus
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
