'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getFilteredIssues, updateIssueStatus, IssueFilterState } from './issueService';

// Interfaces adaptadas a las que genera tu issueService
interface IssueField {
    name: string;
    color?: string;
}

interface Issue {
    id: number;
    subject: string;
    description: string | null;
    type: IssueField | null;       // Objeto con name y color generado por tu servicio
    severity: IssueField | null;   // Objeto con name y color generado por tu servicio
    priority: string | null;
    status: IssueField | null;     // Objeto con name y color generado por tu servicio
    assignee: string | null;
    deadline: string | null;
    modified_at: string | null;
}

interface BackendCounts {
    [key: string]: number;
}

export default function IssuesPage() {
    const [issues, setIssues] = useState<Issue[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState<boolean>(true);
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

    // Contadores del Backend
    const [typeCounts, setTypeCounts] = useState<BackendCounts>({});
    const [severityCounts, setSeverityCounts] = useState<BackendCounts>({});
    const [priorityCounts, setPriorityCounts] = useState<BackendCounts>({});
    const [statusCounts, setStatusCounts] = useState<BackendCounts>({});

    const [localStatusChanges, setLocalStatusChanges] = useState<Record<number, string>>({});

    const [filters, setFilters] = useState<IssueFilterState>({
        search: '',
        order_by: '-created_at',
        issue_type: [],
        issue_severity: [],
        priority: [],
        status: [],
        assigned_to: []
    });

    // Tu API Key única y fija obligatoria
    const apiKey = "Mxk4bUdzGtId8imUNgVKHUiheNKT4AKl";

    const typeDependency = JSON.stringify(filters.issue_type);
    const severityDependency = JSON.stringify(filters.issue_severity);
    const priorityDependency = JSON.stringify(filters.priority);
    const statusDependency = JSON.stringify(filters.status);

    useEffect(() => {
        let isMounted = true;
        const loadIssues = async () => {
            setLoading(true);
            try {
                const data = await getFilteredIssues(filters, apiKey);
                if (isMounted) {
                    setIssues(data.issues || []);
                    setTotalCount(data.total_count || 0);

                    setTypeCounts(data.type_counts || {});
                    setSeverityCounts(data.severity_counts || {});
                    setStatusCounts(data.status_counts || {});

                    setError(null);
                }
            } catch (err) {
                if (isMounted) setError("Error de sincronización.");
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        loadIssues();
        return () => { isMounted = false; };
    }, [filters.search, filters.order_by, typeDependency, severityDependency, priorityDependency, statusDependency, refreshTrigger]);

    const handleCheckboxChange = (category: keyof Omit<IssueFilterState, 'search' | 'order_by'>, value: string) => {
        setFilters(prev => {
            const currentList = prev[category] as string[];
            const updatedList = currentList.includes(value)
                ? currentList.filter(item => item !== value)
                : [...currentList, value];
            return { ...prev, [category]: updatedList };
        });
    };

    const handleInlineStatusChange = (issueId: number, value: string) => {
        setLocalStatusChanges(prev => ({ ...prev, [issueId]: value }));
        setIssues(prevIssues =>
            prevIssues.map(issue => {
                if (issue.id === issueId) {
                    return {
                        ...issue,
                        status: issue.status ? { ...issue.status, name: value } : { name: value }
                    };
                }
                return issue;
            })
        );
    };

    const handleSaveStatus = async (issueId: number, currentStatus: IssueField | null) => {
        const targetStatus = localStatusChanges[issueId] || currentStatus?.name || 'In Progress';

        const success = await updateIssueStatus(issueId, targetStatus, apiKey);
        if (success) {
            setLocalStatusChanges(prev => {
                const copy = { ...prev };
                delete copy[issueId];
                return copy;
            });
            setRefreshTrigger(prev => prev + 1);
        } else {
            alert("Error: El servidor no procesó el cambio. Revisa la URL del endpoint POST.");
        }
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'No date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // --- SE EXTRAEN LOS COLORES QUE TU SERVICIO YA CORRIGIÓ ---
    const getTypeColor = (type: IssueField | null) => {
        return type?.color || '#cbd5e1';
    };

    const getSeverityColor = (sev: IssueField | null) => {
        return sev?.color || '#cbd5e1';
    };

    const getPriorityColor = (prio: string | null) => {
        if (!prio) return '#70728F';
        const clean = prio.toLowerCase().trim();
        if (clean === 'high' || clean === '3') return '#E44057';
        if (clean === 'normal' || clean === '2') return '#E4A840';
        return '#70728F'; // Low
    };

    const getCountSafe = (countsObj: BackendCounts, key: string) => {
        if (!countsObj) return 0;
        if (countsObj[key] !== undefined) return countsObj[key];
        if (countsObj[key.toLowerCase()] !== undefined) return countsObj[key.toLowerCase()];
        return 0;
    };

    return (
        <div style={{ fontFamily: '"Ubuntu", "Segoe UI", sans-serif', color: '#34495e', padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>

                <header style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '25px' }}>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        style={{ padding: '10px 18px', backgroundColor: '#34495e', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer' }}
                    >
                        FILTERS ▾
                    </button>
                    <div style={{ position: 'relative', flexGrow: 1, maxWidth: '450px' }}>
                        <input
                            type="text"
                            placeholder="Search subject, description or ID..."
                            value={filters.search}
                            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                            style={{ width: '100%', padding: '10px 15px', border: '2px solid #e2e8f0', borderRadius: '5px', fontSize: '14px', outline: 'none' }}
                        />
                    </div>
                    <Link href="/issues/new" style={{ marginLeft: 'auto' }}>
                        <button style={{ padding: '10px 20px', backgroundColor: '#5dc5b5', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px', cursor: 'pointer', boxShadow: '0 3px 0 #469b8e' }}>+ NEW ISSUE</button>
                    </Link>
                    <button style={{ padding: '10px 18px', backgroundColor: '#d1d5db', color: '#374151', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 3px 0 #64748b' }}>BULK ADD</button>
                    <button style={{ padding: '10px 18px', backgroundColor: '#d1d5db', color: '#374151', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 3px 0 #64748b' }}>SETTINGS</button>
                    <button style={{ padding: '10px 18px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 3px 0 #475569' }}>PROFILE</button>
                </header>

                <div style={{ display: 'flex', gap: '25px', alignItems: 'flex-start' }}>
                    {showFilters && (
                        <aside style={{ width: '280px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                            <div style={{ padding: '15px', backgroundColor: '#edf2f7', display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
                                <span>Filters ({totalCount})</span>
                            </div>

                            <div style={{ padding: '10px' }}>
                                <h4 style={{ padding: '5px 10px', fontSize: '13px', color: '#34495e', margin: '0' }}>Type</h4>
                                {[
                                    { name: 'Enhancement', color: '#40E4CE' },
                                    { name: 'Bug', color: '#E44057' },
                                    { name: 'Question', color: '#4070E4' }
                                ].map(t => (
                                    <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderLeft: `4px solid ${t.color}`, backgroundColor: '#fcfcfc', marginBottom: '2px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', gap: '8px', cursor: 'pointer', color: '#64748b', margin: 0 }}>
                                            <input type="checkbox" checked={filters.issue_type.includes(t.name)} onChange={() => handleCheckboxChange('issue_type', t.name)} />
                                            {t.name}
                                        </label>
                                        <span style={{ backgroundColor: '#ebf0f5', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>
                                            {getCountSafe(typeCounts, t.name)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ padding: '10px' }}>
                                <h4 style={{ padding: '5px 10px', fontSize: '13px', color: '#34495e', margin: '0' }}>Severity</h4>
                                {[
                                    { name: 'Wishlist', color: '#70728F' },
                                    { name: 'Minor', color: '#40A8E4' },
                                    { name: 'Normal', color: '#40E4A8' },
                                    { name: 'Important', color: '#E4A840' },
                                    { name: 'Critical', color: '#E44057' }
                                ].map(s => (
                                    <div key={s.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderLeft: `4px solid ${s.color}`, backgroundColor: '#fcfcfc', marginBottom: '2px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', gap: '8px', cursor: 'pointer', color: '#64748b', margin: 0 }}>
                                            <input type="checkbox" checked={filters.issue_severity.includes(s.name)} onChange={() => handleCheckboxChange('issue_severity', s.name)} />
                                            {s.name}
                                        </label>
                                        <span style={{ backgroundColor: '#ebf0f5', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>
                                            {getCountSafe(severityCounts, s.name)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ padding: '10px' }}>
                                <h4 style={{ padding: '5px 10px', fontSize: '13px', color: '#34495e', margin: '0' }}>Priority</h4>
                                {[
                                    { name: 'Low', color: '#70728F' },
                                    { name: 'Normal', color: '#E4A840' },
                                    { name: 'High', color: '#E44057' }
                                ].map(p => (
                                    <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderLeft: `4px solid ${p.color}`, backgroundColor: '#fcfcfc', marginBottom: '2px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', gap: '8px', cursor: 'pointer', color: '#64748b', margin: 0 }}>
                                            <input type="checkbox" checked={filters.priority.includes(p.name)} onChange={() => handleCheckboxChange('priority', p.name)} />
                                            {p.name}
                                        </label>
                                        <span style={{ backgroundColor: '#ebf0f5', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>
                                            {getCountSafe(priorityCounts, p.name)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ padding: '10px' }}>
                                <h4 style={{ padding: '5px 10px', fontSize: '13px', color: '#34495e', margin: '0' }}>Status</h4>
                                {['New', 'In Progress', 'Ready for test', 'Needs Info', 'Rejected', 'Postponed', 'Closed'].map(st => (
                                    <div key={st} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fcfcfc', marginBottom: '2px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', gap: '8px', cursor: 'pointer', color: '#64748b', margin: 0 }}>
                                            <input type="checkbox" checked={filters.status.includes(st)} onChange={() => handleCheckboxChange('status', st)} />
                                            {st}
                                        </label>
                                        <span style={{ backgroundColor: '#ebf0f5', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>
                                            {getCountSafe(statusCounts, st)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </aside>
                    )}

                    <main style={{ flexGrow: 1, backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
                        {loading ? (
                            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Sincronizando con el servidor...</div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                    <th style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '60px', textAlign: 'center' }}>TYPE</th>
                                    <th style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '60px', textAlign: 'center' }}>SEV.</th>
                                    <th style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '60px', textAlign: 'center' }}>PRIO.</th>
                                    <th style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', textAlign: 'left' }}>ISSUE</th>
                                    <th style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '160px', textAlign: 'left' }}>STATUS</th>
                                    <th style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '180px', textAlign: 'left' }}>ASSIGNED TO</th>
                                    <th style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '120px', textAlign: 'left' }}>DEADLINE</th>
                                    <th style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '120px', textAlign: 'left' }}>MODIFIED</th>
                                </tr>
                                </thead>
                                <tbody>
                                {issues.map((issue) => (
                                    <tr key={issue.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                        <td style={{ padding: '18px 15px', textAlign: 'center' }}>
                                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', display: 'inline-block', backgroundColor: getTypeColor(issue.type) }} />
                                        </td>
                                        <td style={{ padding: '18px 15px', textAlign: 'center' }}>
                                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', display: 'inline-block', backgroundColor: getSeverityColor(issue.severity) }} />
                                        </td>
                                        <td style={{ padding: '18px 15px', textAlign: 'center' }}>
                                            <span style={{ width: '12px', height: '12px', borderRadius: '50%', display: 'inline-block', backgroundColor: getPriorityColor(issue.priority) }} />
                                        </td>

                                        <td style={{ padding: '18px 15px', textAlign: 'left' }}>
                                            <span style={{ color: '#ff8c00', fontWeight: 'bold', marginRight: '5px' }}>#{issue.id}</span>
                                            <span style={{ color: '#34495e', fontWeight: '500', fontSize: '15px' }}>{issue.subject}</span>
                                        </td>

                                        <td style={{ padding: '18px 15px', textAlign: 'left' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <select
                                                    value={issue.status?.name || 'In Progress'}
                                                    onChange={(e) => handleInlineStatusChange(issue.id, e.target.value)}
                                                    style={{ padding: '5px 8px', border: '1px solid #cbd5e0', borderRadius: '4px', backgroundColor: '#fff', fontSize: '12px' }}
                                                >
                                                    {['New', 'In Progress', 'Ready for test', 'Needs Info', 'Rejected', 'Postponed', 'Closed'].map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                                <button
                                                    onClick={() => handleSaveStatus(issue.id, issue.status)}
                                                    style={{ background: '#5dc5b5', color: 'white', border: 'none', padding: '6px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', marginLeft: '6px' }}
                                                >
                                                    OK
                                                </button>
                                            </div>
                                        </td>

                                        <td style={{ padding: '18px 15px', textAlign: 'left' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span style={{ width: '24px', height: '24px', borderRadius: '50%', backgroundColor: '#34495e', color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 'bold', marginRight: '8px' }}>
                                                    {issue.assignee ? issue.assignee.slice(0, 2).toUpperCase() : '-'}
                                                </span>
                                                <span style={{ color: '#34495e', fontSize: '13px' }}>{issue.assignee || 'Unassigned'}</span>
                                            </div>
                                        </td>

                                        <td style={{ padding: '18px 15px', color: '#94a3b8', fontSize: '13px', textAlign: 'left' }}>
                                            {formatDate(issue.deadline)}
                                        </td>

                                        <td style={{ padding: '18px 15px', color: '#94a3b8', fontSize: '13px', textAlign: 'left' }}>
                                            {formatDate(issue.modified_at)}
                                        </td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        )}
                    </main>
                </div>
            </div>
        </div>
    );
}