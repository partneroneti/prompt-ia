import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Paperclip, Globe, ArrowUp, AlertTriangle, FileText, Download, Search } from 'lucide-react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useAuth } from '../context/AuthContext';
import { processCommandWithAI, confirmAction } from '../services/openai';

const FloatingChat = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [messages, setMessages] = useState([
        { id: 1, type: 'bot', text: 'Olá! Como posso ajudar você hoje?' }
    ]);
    const [pendingAction, setPendingAction] = useState(null);
    const [previewData, setPreviewData] = useState(null);
    const [isTyping, setIsTyping] = useState(false);
    const { queryUsers } = useUser();
    const { getAuthHeaders, user, loading: authLoading } = useAuth();
    const navigate = useNavigate();
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = () => {
        if (!inputValue.trim()) return;

        const userText = inputValue.trim();
        setMessages(prev => [...prev, { id: Date.now(), type: 'user', text: userText }]);
        setInputValue('');

        // Process command
        setTimeout(() => {
            processCommand(userText);
        }, 500);
    };

    const processCommand = async (text) => {
        console.log('[FloatingChat] processCommand CHAMADO com texto:', text);
        const lowerText = text.toLowerCase();

        // Check for pending confirmation
        if (pendingAction) {
            if (lowerText === 'sim' || lowerText === 'confirmar') {
                executePendingAction();
            } else {
                setMessages(prev => [...prev, { id: Date.now(), type: 'bot', text: 'Ação cancelada.' }]);
                setPendingAction(null);
            }
            return;
        }

        // Aguardar carregamento da autenticação
        if (authLoading) {
            setMessages(prev => [...prev, {
                id: Date.now(),
                type: 'bot',
                text: 'Aguarde, verificando autenticação...'
            }]);
            return;
        }

        try {
            // Mostrar animação de digitando
            setIsTyping(true);
            
            console.log('[FloatingChat] processCommand iniciado - user:', user, 'authLoading:', authLoading);
            
            // Verificar se usuário está logado ANTES de obter headers
            if (!user || !user.id) {
                console.warn('[FloatingChat] Usuário não está logado!', { user, authLoading, hasUser: !!user, hasId: user?.id });
                setIsTyping(false);
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'bot',
                    text: 'Erro: Você precisa estar logado para usar o chat. Por favor, faça login novamente.'
                }]);
                return;
            }
            
            console.log('[FloatingChat] Usuário encontrado, verificando ID - user.id:', user.id, 'tipo:', typeof user.id);
            
            // Verificar se user.id é válido e criar headers diretamente
            const userId = user.id;
            if (!userId || userId === undefined || userId === null) {
                console.error('[FloatingChat] ID do usuário inválido!', { user, userId, type: typeof userId });
                setIsTyping(false);
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'bot',
                    text: 'Erro: Sessão inválida. Por favor, faça login novamente.'
                }]);
                return;
            }
            
            // Criar headers diretamente do user.id (mais confiável)
            const authHeaders = {
                'x-user-id': userId.toString()
            };
            
            console.log('[FloatingChat] Criando headers diretamente do user.id:', authHeaders, 'User ID:', userId, 'User completo:', user);
            console.log('[FloatingChat] Chamando processCommandWithAI com:', { text, authHeaders });
            const response = await processCommandWithAI(text, authHeaders);
            
            // Parar animação de digitando
            setIsTyping(false);

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
            }
            else if (response.type === 'CONFIRMATION_REQUIRED') {
                setPendingAction({ 
                    type: 'CONFIRM', 
                    token: response.confirmationToken 
                });
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'bot',
                    isWarning: true,
                    text: response.message
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
            else {
                // Fallback para qualquer outro tipo
                setMessages(prev => [...prev, {
                    id: Date.now(),
                    type: 'bot',
                    text: response.message || response.content || 'Recebi uma resposta que não consegui processar.'
                }]);
            }
        } catch (error) {
            console.error('Erro ao processar comando:', error);
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: Date.now(),
                type: 'bot',
                text: 'Erro ao processar comando. Verifique se o servidor está rodando.'
            }]);
        }
    };

    const executePendingAction = async () => {
        if (!pendingAction || !pendingAction.token) return;

        try {
            setIsTyping(true);
            // Criar headers diretamente do user.id
            const authHeaders = user && user.id ? { 'x-user-id': user.id.toString() } : {};
            const response = await confirmAction(pendingAction.token, authHeaders);
            setIsTyping(false);
            
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
                text: response.message || 'Ação confirmada com sucesso!'
            }]);
        } catch (error) {
            console.error('Erro ao confirmar ação:', error);
            setIsTyping(false);
            setMessages(prev => [...prev, {
                id: Date.now(),
                type: 'bot',
                text: 'Erro ao confirmar ação.'
            }]);
        }
        setPendingAction(null);
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Popover */}
            <div
                className={clsx(
                    'bg-white rounded-2xl shadow-2xl border border-slate-200 w-96 mb-4 transition-all duration-300 origin-bottom-right overflow-hidden flex flex-col',
                    isOpen ? 'opacity-100 scale-100 translate-y-0 h-[500px]' : 'opacity-0 scale-95 translate-y-4 pointer-events-none h-0'
                )}
            >
                {/* Header */}
                <div className="px-4 py-3 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-blue-600" />
                        <h3 className="text-slate-800 font-semibold text-sm">Suporte IA</h3>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Chat Body */}
                <div className="flex-1 bg-slate-50/50 p-4 overflow-y-auto">
                    {messages.map((msg) => (
                        <div key={msg.id} className={clsx("flex gap-3 mb-4", msg.type === 'user' ? "flex-row-reverse" : "")}>
                            <div className={clsx(
                                "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm",
                                msg.type === 'user' ? "bg-slate-200" : "bg-white border border-slate-200"
                            )}>
                                {msg.type === 'user' ? <div className="w-4 h-4 bg-slate-400 rounded-full" /> : <Sparkles size={14} className="text-blue-600" />}
                            </div>
                            <div className={clsx(
                                "p-3 rounded-2xl shadow-sm border text-sm leading-relaxed",
                                msg.type === 'user'
                                    ? "bg-blue-600 text-white border-blue-600 rounded-tr-none"
                                    : msg.isWarning
                                        ? "bg-amber-50 border-amber-200 text-amber-900 rounded-tl-none"
                                        : "bg-white border-slate-100 text-slate-700 rounded-tl-none"
                            )}>
                                {msg.isWarning && (
                                    <div className="flex items-center gap-2 mb-2 text-amber-600 font-bold uppercase text-xs tracking-wider">
                                        <AlertTriangle size={12} />
                                        Confirmação
                                    </div>
                                )}
                                {msg.isCustomReport && (
                                    <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                        <div className="text-xs font-semibold text-blue-900 mb-2">📊 {msg.reportName}</div>
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
                                                        const response = await fetch(`/api/reports/preview`, {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({ type: msg.reportId })
                                                        });
                                                        if (!response.ok) {
                                                            throw new Error('Erro ao buscar preview');
                                                        }
                                                        const data = await response.json();
                                                        if (data.rows && data.rows.length > 0) {
                                                            // Mostrar preview em uma nova mensagem
                                                            setPreviewData({
                                                                columns: Object.keys(data.rows[0]),
                                                                rows: data.rows.slice(0, 10), // Mostrar apenas 10 primeiros
                                                                total: data.count
                                                            });
                                                        } else {
                                                            alert('Nenhum registro encontrado.');
                                                        }
                                                    } catch (error) {
                                                        console.error('Erro ao visualizar:', error);
                                                        alert('Erro ao visualizar relatório. Tente novamente.');
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
                                {msg.text}
                            </div>
                        </div>
                    ))}
                    
                    {/* Animação de digitando */}
                    {isTyping && (
                        <div className="flex gap-3 mb-4">
                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm bg-white border border-slate-200">
                                <Sparkles size={14} className="text-blue-600" />
                            </div>
                            <div className="p-3 rounded-2xl shadow-sm border text-sm bg-white border-slate-100 text-slate-700 rounded-tl-none">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.4s' }}></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s', animationDuration: '1.4s' }}></div>
                                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s', animationDuration: '1.4s' }}></div>
                                </div>
                            </div>
                        </div>
                    )}
                    
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

                    {/* Suggestions (Only show if few messages) */}
                    {messages.length < 3 && (
                        <div className="space-y-1 mt-6">
                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Sugestões</p>

                            <button
                                onClick={() => { setInputValue("Como cadastrar usuário?"); handleSend(); }}
                                className="w-full text-left p-2 hover:bg-white hover:shadow-sm rounded-lg flex items-center gap-3 group transition-all border border-transparent hover:border-slate-100"
                            >
                                <div className="w-6 h-6 rounded bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                                    <span className="text-xs font-bold">?</span>
                                </div>
                                <span className="text-sm text-slate-600 group-hover:text-slate-900">Como cadastrar usuário?</span>
                            </button>

                            <button
                                onClick={() => setInputValue("Resetar senha de empresa")}
                                className="w-full text-left p-2 hover:bg-white hover:shadow-sm rounded-lg flex items-center gap-3 group transition-all border border-transparent hover:border-slate-100"
                            >
                                <div className="w-6 h-6 rounded bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                                    <span className="text-xs font-bold">R</span>
                                </div>
                                <span className="text-sm text-slate-600 group-hover:text-slate-900">Resetar senha de empresa</span>
                            </button>

                            <button
                                onClick={() => setInputValue("Relatório de bloqueados")}
                                className="w-full text-left p-2 hover:bg-white hover:shadow-sm rounded-lg flex items-center gap-3 group transition-all border border-transparent hover:border-slate-100"
                            >
                                <div className="w-6 h-6 rounded bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                                    <span className="text-xs font-bold">!</span>
                                </div>
                                <span className="text-sm text-slate-600 group-hover:text-slate-900">Relatório de bloqueados</span>
                                <span className="ml-auto text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-medium">New</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Floating Input Area (Notion Style) */}
                <div className="p-4 bg-white border-t border-slate-100">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all p-2">
                        {/* Context Pills */}
                        <div className="flex gap-2 mb-2 px-1">
                            <div className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-full px-2 py-0.5 text-[10px] text-slate-500 font-medium">
                                <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                                <span>Suporte Context</span>
                            </div>
                        </div>

                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Digite sua dúvida..."
                            className="w-full bg-transparent text-slate-800 placeholder-slate-400 px-2 py-1 text-sm focus:outline-none"
                        />

                        <div className="flex items-center justify-between mt-2 px-1 pt-1 border-t border-slate-50">
                            <div className="flex items-center gap-3">
                                <button className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <Paperclip size={16} />
                                </button>
                                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-medium cursor-pointer hover:text-slate-600">
                                    <Sparkles size={12} />
                                    <span>Auto</span>
                                </div>
                            </div>

                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim()}
                                className={clsx(
                                    "w-7 h-7 rounded-full flex items-center justify-center transition-all",
                                    inputValue.trim()
                                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                                        : "bg-slate-100 text-slate-300 cursor-not-allowed"
                                )}
                            >
                                <ArrowUp size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* FAB */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={clsx(
                    'p-4 rounded-full shadow-xl transition-all duration-300 hover:scale-105 active:scale-95 border border-white/10',
                    isOpen ? 'bg-slate-800 text-white rotate-90' : 'bg-blue-600 text-white'
                )}
            >
                {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
            </button>
        </div>
    );
};

export default FloatingChat;
