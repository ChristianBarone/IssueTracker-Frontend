'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { getFilteredIssues, IssueFilterState, IssueListResult } from './issueService';
import { getStoredApiKey, getStoredUsername } from '../lib/auth';
import { fetchEntities } from '../settings/settingsService';

interface IssueField {
    name: string;
    color?: string;
}

interface Issue {
    id: number;
    subject: string;
    description: string | null;
    type: IssueField | null;
    severity: IssueField | null;
    priority: string | null;
    status: IssueField | null;
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
    const [showFilters, setShowFilters] = useState<boolean>(false);
    const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

    const [typeCounts, setTypeCounts] = useState<BackendCounts>({});
    const [severityCounts, setSeverityCounts] = useState<BackendCounts>({});
    const [priorityCounts, setPriorityCounts] = useState<BackendCounts>({});
    const [statusCounts, setStatusCounts] = useState<BackendCounts>({});
    const [statuses, setStatuses] = useState<Array<{ name: string; color?: string }>>([]);

    const [filters, setFilters] = useState<IssueFilterState>({
        search: '',
        order_by: '-created_at',
        issue_type: [],
        issue_severity: [],
        priority: [],
        status: [],
        assigned_to: []
    });

    const apiKey = getStoredApiKey();
    const currentUser = getStoredUsername() ?? 'Andreu-Caro';

    const handleSort = (field: string) => {
        setFilters(prev => {
            const nextOrder = prev.order_by === field ? `-${field}` : field;
            return { ...prev, order_by: nextOrder };
        });
    };

    const renderSortIcon = (field: string) => {
        const isCurrent = filters.order_by.replace('-', '') === field;
        const isDescending = filters.order_by.startsWith('-');

        return (
            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', marginLeft: '6px', lineHeight: '0.6' }}>
                <span style={{ fontSize: '9px', color: isCurrent && !isDescending ? '#34495e' : '#cbd5e1', marginBottom: '1px' }}>▲</span>
                <span style={{ fontSize: '9px', color: isCurrent && isDescending ? '#34495e' : '#cbd5e1' }}>▼</span>
            </div>
        );
    };

    const filtersString = JSON.stringify({
        search: filters.search,
        order_by: filters.order_by,
        issue_type: filters.issue_type,
        issue_severity: filters.issue_severity,
        priority: filters.priority,
        status: filters.status,
        assigned_to: filters.assigned_to
    });

    useEffect(() => {
        let isMounted = true;
        const loadIssues = async () => {
            setLoading(true);
            try {
                if (!apiKey) {
                    throw new Error('Session expired. Please sign in again.');
                }

                const currentFilters = JSON.parse(filtersString) as IssueFilterState;
                const data: IssueListResult = await getFilteredIssues(currentFilters, apiKey);
                if (isMounted) {
                    if (data.error) {
                        setError(data.error);
                    } else {
                        setError(null);
                    }

                    // CORREGIDO: Tipado seguro sin usar 'any' para evitar que se queje el linter
                    const normalizedIssues = (data.issues || []).map((issue: Record<string, unknown>) => ({
                        ...issue,
                        id: Number(issue.id),
                        subject: String(issue.subject || ''),
                        description: issue.description ? String(issue.description) : null,
                        type: (issue.type as IssueField | null),
                        severity: (issue.severity as IssueField | null),
                        priority: issue.priority ? String(issue.priority) : null,
                        assignee: issue.assignee ? String(issue.assignee) : null,
                        deadline: issue.deadline ? String(issue.deadline) : null,
                        modified_at: issue.modified_at ? String(issue.modified_at) : null,
                        status: typeof issue.status === 'string'
                            ? { name: issue.status }
                            : ((issue.status as IssueField | null) || { name: 'In Progress' })
                    }));

                    setIssues(normalizedIssues);
                    setTotalCount(data.total_count || 0);

                    setTypeCounts(data.type_counts || {});
                    setSeverityCounts(data.severity_counts || {});
                    setStatusCounts(data.status_counts || {});
                    setPriorityCounts(data.priority_counts || {});

                }
            } catch (err) {
                if (isMounted) setError(err instanceof Error ? err.message : 'Sincronization error.');
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        loadIssues();
        return () => { isMounted = false; };
    }, [filtersString, refreshTrigger, apiKey]);

    useEffect(() => {
        let isMounted = true;

        const loadStatuses = async () => {
            const storedApiKey = getStoredApiKey();
            if (!storedApiKey) return;

            try {
                const data = await fetchEntities('statuses', storedApiKey);
                if (!isMounted) return;
                setStatuses((data || []).map((status) => ({
                    name: status.name,
                    color: status.color,
                })));
            } catch (err) {
                console.error('Error loading statuses from settings:', err);
            }
        };

        loadStatuses();
        return () => { isMounted = false; };
    }, []);

    const handleCheckboxChange = (category: keyof Omit<IssueFilterState, 'search' | 'order_by'>, value: string) => {
        setFilters(prev => {
            const currentList = prev[category] as string[];
            const updatedList = currentList.includes(value)
                ? currentList.filter(item => item !== value)
                : [...currentList, value];
            return { ...prev, [category]: updatedList };
        });
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return 'No date';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getStatusColor = (statusName: string | undefined): string => {
        if (!statusName) return '#CCCCCC';
        const needle = statusName.trim().toLowerCase();
        return statuses.find(s => s.name.trim().toLowerCase() === needle)?.color || '#CCCCCC';
    };

    const getTypeColor = (type: IssueField | null) => type?.color || '#cbd5e1';
    const getSeverityColor = (sev: IssueField | null) => sev?.color || '#cbd5e1';
    const getPriorityColor = (prio: string | null) => {
        if (!prio) return '#70728F';
        const clean = prio.toLowerCase().trim();
        if (clean === 'high' || clean === '3') return '#E44057';
        if (clean === 'normal' || clean === '2') return '#E4A840';
        return '#70728F';
    };

    const getCountSafe = (countsObj: BackendCounts, key: string) => {
        if (!countsObj) return 0;
        return countsObj[key] !== undefined ? countsObj[key] : (countsObj[key.toLowerCase()] !== undefined ? countsObj[key.toLowerCase()] : 0);
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
                    <Link href="/issues/new-bulk">
                        <button style={{ padding: '10px 18px', backgroundColor: '#d1d5db', color: '#374151', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 3px 0 #64748b', cursor: 'pointer' }}>BULK ADD</button>
                    </Link>
                    <Link href="/settings">
                        <button style={{ padding: '10px 18px', backgroundColor: '#d1d5db', color: '#374151', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 3px 0 #64748b', cursor: 'pointer' }}>SETTINGS</button>
                    </Link>
                    <Link href={`/profile/${encodeURIComponent(currentUser)}`} style={{ textDecoration: 'none' }}>
                        <button style={{ padding: '10px 18px', backgroundColor: '#64748b', color: '#fff', border: 'none', borderRadius: '5px', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 3px 0 #475569', cursor: 'pointer' }}>PROFILE</button>
                    </Link>
                </header>

                <div style={{ display: 'flex', gap: '25px', alignItems: 'flex-start' }}>
                    {showFilters && (
                        <aside style={{ width: '280px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                            {error && (
                                <div style={{ margin: '12px', padding: '12px 14px', borderRadius: '10px', border: '1px solid #fecaca', backgroundColor: '#fff1f2', color: '#be123c', fontSize: '13px', fontWeight: 600 }}>
                                    {error}
                                </div>
                            )}
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
                                        {/* CORREGIDO: Modificado font_weight por fontWeight */}
                                        <span style={{ backgroundColor: '#ebf0f5', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>
                                            {getCountSafe(priorityCounts, p.name)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <div style={{ padding: '10px' }}>
                                <h4 style={{ padding: '5px 10px', fontSize: '13px', color: '#34495e', margin: '0' }}>Status</h4>
                                {statuses.map(st => (
                                    <div key={st.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fcfcfc', marginBottom: '2px' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', gap: '8px', cursor: 'pointer', color: '#64748b', margin: 0 }}>
                                            <input type="checkbox" checked={filters.status.includes(st.name)} onChange={() => handleCheckboxChange('status', st.name)} />
                                            {st.name}
                                        </label>
                                        <span style={{ backgroundColor: '#ebf0f5', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', minWidth: '20px', textAlign: 'center' }}>
                                            {getCountSafe(statusCounts, st.name)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </aside>
                    )}

                    <main style={{ flexGrow: 1, backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', overflow: 'hidden' }}>
                        {loading ? (
                            <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>Fetching issues...</div>
                        ) : error ? (
                                <div style={{ padding: '60px', textAlign: 'center', color: '#b91c1c' }}>{error}</div>
                            ) : (
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                                        <th onClick={() => handleSort('issue_type')} style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '80px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span>TYPE</span>{renderSortIcon('issue_type')}
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('issue_severity')} style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '80px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span>SEV.</span>{renderSortIcon('issue_severity')}
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('priority')} style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '80px', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <span>PRIO.</span>{renderSortIcon('priority')}
                                            </div>
                                        </th>
                                        <th onClick={() => handleSort('subject')} style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                                <span>ISSUE</span>{renderSortIcon('subject')}
                                            </div>
                                        </th>
                                    <th onClick={() => handleSort('status')} style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '160px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span>STATUS</span>{renderSortIcon('status')}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('assignee')} style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '180px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span>ASSIGNED TO</span>{renderSortIcon('assignee')}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('deadline')} style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '120px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span>DEADLINE</span>{renderSortIcon('deadline')}
                                        </div>
                                    </th>
                                    <th onClick={() => handleSort('modified_at')} style={{ padding: '15px', fontSize: '11px', color: '#94a3b8', width: '120px', textAlign: 'left', cursor: 'pointer', userSelect: 'none' }}>
                                        <div style={{ display: 'flex', alignItems: 'center' }}>
                                            <span>MODIFIED</span>{renderSortIcon('modified_at')}
                                        </div>
                                    </th>
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
                                                <Link
                                                    href={`/issues/${issue.id}`}
                                                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
                                                >
                                                    <span style={{ color: '#ff8c00', fontWeight: 'bold', marginRight: '6px', cursor: 'pointer' }}>
                                                        #{issue.id}
                                                    </span>
                                                    <span style={{ color: '#34495e', fontWeight: '500', fontSize: '15px', cursor: 'pointer' }} onMouseEnter={(e) => e.currentTarget.style.color = '#5dc5b5'} onMouseLeave={(e) => e.currentTarget.style.color = '#34495e'}>
                                                        {issue.subject}
                                                    </span>
                                                </Link>
                                            </td>

                                            <td style={{ padding: '18px 15px', textAlign: 'left' }}>
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#34495e' }}>
                                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', flexShrink: 0, backgroundColor: getStatusColor(issue.status?.name) }} />
                                                    {issue.status?.name || 'In Progress'}
                                                </span>
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