'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AUTH_USERS, getStoredApiKey, getStoredUsername, getUserIdByUsername } from '../../lib/auth';
import { fetchEntities } from '../../settings/settingsService';
import { createIssue } from "@/app/issues/issueService";

export default function CreateIssuePage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        subject: '',
        description: '',
        status: 'In Progress',
        assigned_to: '',
        issue_type: 'Bug',
        issue_severity: 'Normal',
        priority: 'Normal',
        deadline: '',
        files: [] as File[],
    });

    const [statuses, setStatuses] = useState<Array<{ name: string }>>([]);
    const [types, setTypes] = useState<Array<{ name: string }>>([]);
    const [severities, setSeverities] = useState<Array<{ name: string }>>([]);
    const [priorities, setPriorities] = useState<Array<{ name: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const getApiKey = () => getStoredApiKey();
    const currentUser = getStoredUsername();
    const currentUserId = useMemo(() => {
        if (!currentUser) return null;
        return getUserIdByUsername(currentUser);
    }, [currentUser]);

    useEffect(() => {
        const loadEntities = async () => {
            const apiKey = getApiKey();
            if (!apiKey) return;

            try {
                const [statusList, typeList, severityList, priorityList] = await Promise.all([
                    fetchEntities('statuses', apiKey),
                    fetchEntities('types', apiKey),
                    fetchEntities('severities', apiKey),
                    fetchEntities('priorities', apiKey)
                ]);

                setStatuses(statusList);
                setTypes(typeList);
                setSeverities(severityList);
                setPriorities(priorityList);
            } catch (err) {
                console.error('Error loading settings entities:', err);
            }
        };
        loadEntities();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement;

        if (target.type === 'file' && target.files) {
            setFormData({
                ...formData,
                files: Array.from(target.files)
            });
        } else {
            setFormData({
                ...formData,
                [e.target.name]: e.target.value
            });
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setStatusMessage(null);

        if (!formData.subject.trim()) {
            setStatusMessage({ text: 'El títol (Subject) és obligatori.', isError: true });
            setLoading(false);
            return;
        }

        try {
            const dataEnvelope = new FormData();

            dataEnvelope.append('subject', formData.subject);
            dataEnvelope.append('description', formData.description);
            dataEnvelope.append('issue_type', formData.issue_type);
            dataEnvelope.append('issue_severity', formData.issue_severity);
            dataEnvelope.append('priority', formData.priority);
            dataEnvelope.append('status', formData.status);

            if (formData.deadline) {
                dataEnvelope.append('deadline', formData.deadline);
            }

            if (formData.assigned_to) {
                dataEnvelope.append('assignee', formData.assigned_to);
            }

            formData.files.forEach(file => {
                dataEnvelope.append('files', file);
            });

            const response = await createIssue(dataEnvelope)
            const data = await response.json()

            if (response.ok) {
                setStatusMessage({ text: `Successfully created issue #${data.id}!`, isError: false });
                router.push('/issues');
            } else {
                console.error("Detalle del error de Django:", data);

                let serverError = 'Error del servidor al validar los campos.';
                if (data && typeof data === 'object' && Object.keys(data).length > 0) {
                    serverError = JSON.stringify(data);
                }

                setStatusMessage({
                    text: data.error || data.message || serverError,
                    isError: true
                });
            }
        } catch {
            setStatusMessage({ text: 'Error de connexió amb el Back-End.', isError: true });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = () => {
        router.push('/issues');
    };

    return (
        <div className="min-h-screen bg-[#f4f7f9] text-[#333] font-sans flex flex-col items-center justify-start py-12 px-4">
            <div className="w-full max-w-5xl bg-white rounded-lg shadow-sm border border-zinc-200/60 p-8">

                <h1 className="text-center text-[28px] font-normal text-[#2c3e50] mb-8">
                    New issue
                </h1>

                {statusMessage && (
                    <div className={`p-4 mb-6 rounded-md text-sm font-medium border ${
                        statusMessage.isError
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                        {statusMessage.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">

                    {/* CONTINGUT */}
                    <div className="md:col-span-2 flex flex-col gap-5">
                        <div className="flex flex-col gap-1">
                            <input
                                type="text"
                                name="subject"
                                value={formData.subject}
                                onChange={handleChange}
                                placeholder="Subject"
                                className="w-full px-4 py-3 rounded border border-[#a3dbc5] bg-white text-base outline-none focus:border-[#4db6ac] transition-colors"
                            />
                            <button type="button" className="text-left text-[13px] text-[#4db6ac] hover:underline mt-1 font-medium cursor-pointer">
                                Add tag +
                            </button>
                        </div>

                        <div>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                placeholder="Please add descriptive text to help others better understand this issue"
                                rows={10}
                                className="w-full px-4 py-3 rounded border border-zinc-300 bg-white text-base outline-none focus:border-zinc-400 text-zinc-600 placeholder-zinc-400 resize-none"
                            />
                        </div>

                        <div className="flex flex-col gap-2">
                            <span className="text-base font-medium text-[#2c3e50]">Add attachment</span>
                            <div className="border border-dashed border-zinc-300 rounded p-8 text-center text-zinc-400 bg-zinc-50/50 text-sm cursor-pointer">
                                <input type="file" className="cursor-pointer" onChange={handleChange} name="files"/>
                            </div>
                        </div>
                    </div>

                    {/* ATRIBUTS */}
                    <div className="bg-[#f8fafc] border border-zinc-200/80 rounded p-5 flex flex-col gap-5 h-fit">

                        <div className="flex flex-col gap-1.5">
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full bg-[#64748b] text-white font-semibold px-4 py-2.5 rounded text-sm outline-none cursor-pointer"
                            >
                                {statuses.length > 0 ? (
                                    statuses.map((status) => (
                                        <option key={status.name} value={status.name}>{status.name}</option>
                                    ))
                                ) : (
                                    <option value="">Loading...</option>
                                )}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Assigned To</label>
                            <div className="flex flex-col gap-2">
                                <select
                                    name="assigned_to"
                                    value={formData.assigned_to}
                                    onChange={handleChange}
                                    className="w-full bg-white border border-zinc-300 rounded px-3 py-2 text-sm outline-none text-zinc-700 cursor-pointer"
                                >
                                    <option value="">Unassigned</option>
                                    {AUTH_USERS.map((user) => (
                                        <option key={user.id} value={String(user.id)}>{user.username}</option>
                                    ))}
                                </select>
                                <button
                                    type="button"
                                    onClick={() => setFormData((prev) => ({
                                        ...prev,
                                        assigned_to: currentUserId == null ? '' : String(currentUserId)
                                    }))}
                                    disabled={currentUserId == null}
                                    className="w-fit whitespace-nowrap border border-zinc-300 bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700 rounded hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer" // ◄ MODIFICADO: cursor-pointer
                                >
                                    Assign to me
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Type</label>
                            <select
                                name="issue_type"
                                value={formData.issue_type}
                                onChange={handleChange}
                                className="w-full bg-white border border-zinc-300 rounded px-3 py-2 text-sm outline-none text-zinc-700 cursor-pointer"
                            >
                                {types.length > 0 ? (
                                    types.map((type) => (
                                        <option key={type.name} value={type.name}>{type.name}</option>
                                    ))
                                ) : (
                                    <option value="">Loading...</option>
                                )}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Severity</label>
                            <select
                                name="issue_severity"
                                value={formData.issue_severity}
                                onChange={handleChange}
                                className="w-full bg-white border border-zinc-300 rounded px-3 py-2 text-sm outline-none text-zinc-700 cursor-pointer"
                            >
                                {severities.length > 0 ? (
                                    severities.map((severity) => (
                                        <option key={severity.name} value={severity.name}>{severity.name}</option>
                                    ))
                                ) : (
                                    <option value="">Loading...</option>
                                )}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Priority</label>
                            <select
                                name="priority"
                                value={formData.priority}
                                onChange={handleChange}
                                className="w-full bg-white border border-zinc-300 rounded px-3 py-2 text-sm outline-none text-zinc-700 cursor-pointer"
                            >
                                {priorities.length > 0 ? (
                                    priorities.map((priority) => (
                                        <option key={priority.name} value={priority.name}>{priority.name}</option>
                                    ))
                                ) : (
                                    <option value="">Loading...</option>
                                )}
                            </select>
                        </div>

                        <div className="flex flex-col gap-1">
                            <label className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-zinc-400">Deadline</label>
                            <input
                                type="date"
                                name="deadline"
                                value={formData.deadline}
                                onChange={handleChange}
                                className="w-full bg-white border border-zinc-300 rounded px-3 py-2 text-sm outline-none text-zinc-600 font-mono cursor-pointer"
                            />
                        </div>

                    </div>

                    <div className="md:col-span-3 flex flex-col items-center gap-3 mt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full h-11 text-base font-medium uppercase tracking-wider rounded transition-colors cursor-pointer ${
                                loading
                                    ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
                                    : 'bg-[#80cbd7] text-white hover:bg-[#4db6ac] shadow-sm'
                            }`}
                        >
                            {loading ? 'Creating...' : 'Create'}
                        </button>

                        <button
                            type="button"
                            onClick={handleCancel}
                            className="text-xs font-medium uppercase tracking-wider text-zinc-400 hover:text-zinc-600 transition-colors py-1 cursor-pointer"
                        >
                            Cancel
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
}