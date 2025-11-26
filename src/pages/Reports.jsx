import React, { useState, useEffect } from 'react';
import { FileText, Download, Users, Building2, DollarSign, Calendar, Filter, Search } from 'lucide-react';

const Reports = () => {
    const [selectedReport, setSelectedReport] = useState('users');
    const [filters, setFilters] = useState({
        status: '',
        operation: '',
        dateFrom: '',
        dateTo: ''
    });
    const [loading, setLoading] = useState(false);
    const [recentReports, setRecentReports] = useState([]);
    const [operations, setOperations] = useState([]);
    const [loadingOperations, setLoadingOperations] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewColumns, setPreviewColumns] = useState([]);
    const [customReports, setCustomReports] = useState([]);

    const [reportTypes, setReportTypes] = useState([
        {
            id: 'users',
            name: 'Relatório de Usuários',
            icon: Users,
            description: 'Lista completa de usuários com filtros por status, operação e data'
        },
        {
            id: 'operations',
            name: 'Relatório de Operações',
            icon: Building2,
            description: 'Usuários agrupados por operação/empresa'
        },
        {
            id: 'commissions',
            name: 'Relatório de Comissões',
            icon: DollarSign,
            description: 'Extrato de comissões com valores e status'
        },
        {
            id: 'audit',
            name: 'Relatório de Auditoria',
            icon: FileText,
            description: 'Log de ações e alterações no sistema'
        }
    ]);

    // Buscar operações e relatórios customizados ao montar o componente
    useEffect(() => {
        const fetchOperations = async () => {
            setLoadingOperations(true);
            try {
                const response = await fetch('/api/operations');
                if (!response.ok) {
                    throw new Error('Erro ao carregar operações');
                }
                const data = await response.json();
                setOperations(data);
            } catch (error) {
                console.error('Erro ao carregar operações:', error);
            } finally {
                setLoadingOperations(false);
            }
        };

        fetchOperations();
        
        // Buscar relatórios customizados
        const fetchCustomReports = async () => {
            try {
                const response = await fetch('/api/reports/custom');
                if (!response.ok) {
                    throw new Error('Erro ao carregar relatórios customizados');
                }
                const data = await response.json();
                setCustomReports(data);
                
                // Adicionar relatórios customizados à lista
                const customReportTypes = data.map(report => ({
                    id: report.id,
                    name: report.name,
                    icon: FileText, // Ícone padrão para customizados
                    description: report.description,
                    isCustom: true
                }));
                
                setReportTypes(prev => [...prev, ...customReportTypes]);
            } catch (error) {
                console.error('Erro ao carregar relatórios customizados:', error);
            }
        };
        
        fetchCustomReports();
    }, []);

    const generateReport = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: selectedReport,
                    filters: filters
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao gerar relatório');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `relatorio_${selectedReport}_${new Date().toISOString().split('T')[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Adicionar à lista de relatórios recentes
            setRecentReports(prev => [{
                type: selectedReport,
                date: new Date().toLocaleString(),
                filters: filters
            }, ...prev].slice(0, 5));

            alert('Relatório gerado com sucesso!');
        } catch (error) {
            console.error('Erro ao gerar relatório:', error);
            alert('Erro ao gerar relatório. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    const previewReport = async () => {
        setLoading(true);
        try {
            const response = await fetch('/api/reports/preview', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: selectedReport,
                    filters: filters
                })
            });

            if (!response.ok) {
                throw new Error('Erro ao visualizar relatório');
            }

            const data = await response.json();
            
            if (data.rows && data.rows.length > 0) {
                // Extrair colunas do primeiro registro
                const columns = Object.keys(data.rows[0]);
                setPreviewColumns(columns);
                setPreviewData(data.rows);
            } else {
                setPreviewData([]);
                setPreviewColumns([]);
                alert('Nenhum registro encontrado com os filtros selecionados.');
            }
        } catch (error) {
            console.error('Erro ao visualizar relatório:', error);
            alert('Erro ao visualizar relatório.');
            setPreviewData(null);
            setPreviewColumns([]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Relatórios</h2>
                    <p className="text-sm text-slate-500 mt-1">Gere e exporte relatórios em CSV</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Seleção de Tipo de Relatório */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <FileText size={20} />
                            Tipo de Relatório
                        </h3>
                        <div className="space-y-2">
                            {reportTypes.map((report) => {
                                const Icon = report.icon;
                                return (
                                    <button
                                        key={report.id}
                                        onClick={() => setSelectedReport(report.id)}
                                        className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                                            selectedReport === report.id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <Icon size={24} className={`mt-1 ${
                                                selectedReport === report.id ? 'text-blue-600' : 'text-slate-400'
                                            }`} />
                                            <div className="flex-1">
                                                <div className={`font-medium ${
                                                    selectedReport === report.id ? 'text-blue-900' : 'text-slate-800'
                                                }`}>
                                                    {report.name}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1">
                                                    {report.description}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Filtros e Ações */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <Filter size={20} />
                            Filtros
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {selectedReport === 'users' && (
                                <>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Status
                                        </label>
                                        <select
                                            value={filters.status}
                                            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        >
                                            <option value="">Todos</option>
                                            <option value="ATIVO">Ativo</option>
                                            <option value="BLOQUEADO">Bloqueado</option>
                                            <option value="INATIVO">Inativo</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-2">
                                            Operação
                                        </label>
                                        <select
                                            value={filters.operation}
                                            onChange={(e) => setFilters({ ...filters, operation: e.target.value })}
                                            disabled={loadingOperations}
                                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100 disabled:cursor-not-allowed"
                                        >
                                            <option value="">Todos</option>
                                            {operations.map((op) => (
                                                <option key={op.id_operacao} value={op.str_descricao}>
                                                    {op.str_descricao}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Data Inicial
                                </label>
                                <input
                                    type="date"
                                    value={filters.dateFrom}
                                    onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Data Final
                                </label>
                                <input
                                    type="date"
                                    value={filters.dateTo}
                                    onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={previewReport}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Search size={20} />
                                Visualizar
                            </button>
                            <button
                                onClick={generateReport}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Download size={20} />
                                {loading ? 'Gerando...' : 'Gerar CSV'}
                            </button>
                        </div>
                    </div>

                    {/* Visualização de Dados */}
                    {previewData !== null && (
                        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                                    <Search size={20} />
                                    Visualização ({previewData.length} registros)
                                </h3>
                                <button
                                    onClick={() => {
                                        setPreviewData(null);
                                        setPreviewColumns([]);
                                    }}
                                    className="text-sm text-slate-500 hover:text-slate-700"
                                >
                                    Fechar
                                </button>
                            </div>
                            
                            <div className="overflow-x-auto">
                                <div className="bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-slate-700">
                                                {previewColumns.map((col) => (
                                                    <th
                                                        key={col}
                                                        className="px-4 py-3 text-left font-semibold text-slate-300 uppercase text-xs tracking-wide"
                                                    >
                                                        {col}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {previewData.length === 0 ? (
                                                <tr>
                                                    <td
                                                        colSpan={previewColumns.length}
                                                        className="px-4 py-8 text-center text-slate-400"
                                                    >
                                                        Nenhum registro encontrado
                                                    </td>
                                                </tr>
                                            ) : (
                                                previewData.map((row, rowIndex) => (
                                                    <tr
                                                        key={rowIndex}
                                                        className="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"
                                                    >
                                                        {previewColumns.map((col) => {
                                                            let value = row[col];
                                                            if (value === null || value === undefined) {
                                                                value = '-';
                                                            } else if (value instanceof Date) {
                                                                value = new Date(value).toLocaleString('pt-BR');
                                                            } else if (typeof value === 'string' && value.includes('T') && value.match(/^\d{4}-\d{2}-\d{2}T/)) {
                                                                // Formatar datas ISO
                                                                value = new Date(value).toLocaleString('pt-BR');
                                                            } else {
                                                                value = String(value);
                                                            }
                                                            
                                                            return (
                                                                <td
                                                                    key={col}
                                                                    className="px-4 py-3 text-slate-200 font-normal"
                                                                >
                                                                    {value}
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Relatórios Recentes */}
                    {recentReports.length > 0 && (
                        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                            <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                                <Calendar size={20} />
                                Relatórios Recentes
                            </h3>
                            <div className="space-y-2">
                                {recentReports.map((report, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                        <div>
                                            <div className="font-medium text-slate-800">
                                                {reportTypes.find(r => r.id === report.type)?.name}
                                            </div>
                                            <div className="text-xs text-slate-500">{report.date}</div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setSelectedReport(report.type);
                                                setFilters(report.filters);
                                            }}
                                            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                                        >
                                            Reutilizar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Reports;

