'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateIssuePage() {
    const router = useRouter();

    const [formData, setFormData] = useState({
        subject: '',
        description: '',
        status: 'In Progress',
        assigned_to: 'Unassigned',
        issue_type: 'Bug',
        issue_severity: 'Normal',
        priority: 'Normal',
        deadline: ''
    });

    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const getApiKey = () => 'Mxk4bUdzGtId8imUNgVKHUiheNKT4AKl';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
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

            if (formData.assigned_to !== 'Unassigned') {
                dataEnvelope.append('assignee', formData.assigned_to);
            }

            const response = await fetch('https://issuetracker-ff8u.onrender.com/issues/', {
                method: 'POST',
                headers: {
                    'Authorization': getApiKey()
                },
                body: dataEnvelope
            });

            const data = await response.json().catch(() => ({}));

            if (response.ok) {
                setStatusMessage({ text: `¡Issue #${data.id} creat amb èxit!`, isError: false });
                router.push('/issues');
            } else {
                console.error("Detalle del error de Django:", data);
                setStatusMessage({
                    text: data.error || data.message || 'Error del servidor al validar los campos.',
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

                {/* TÍTOL CENTRAL DE LA INTERFÍCIE */}
                <h1 className="text-center text-[28px] font-normal text-[#2c3e50] mb-8">
                    New issue
                </h1>

                {/* FEEDBACK */}
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
                        {/* SUBJECT */}
                        <div className="flex flex-col gap-1">
                            <input
                                type="text"
                                name="subject"
                                value={formData.subject}
                                onChange={handleChange}
                                placeholder="Subject"
                                className="w-full px-4 py-3 rounded border border-[#a3dbc5] bg-white text-base outline-none focus:border-[#4db6ac] transition-colors"
                            />
                            <button type="button" className="text-left text-[13px] text-[#4db6ac] hover:underline mt-1 font-medium">
                                Add tag +
                            </button>
                        </div>

                        {/* DESCRIPCIÓ */}
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

                        {/* ATTACHMENTS */}
                        <div className="flex flex-col gap-2">
                            <span className="text-base font-medium text-[#2c3e50]">Add attachments</span>
                            <div className="border border-dashed border-zinc-300 rounded p-8 text-center text-zinc-400 bg-zinc-50/50 text-sm">
                                <input type="file" className="hidden" id="file-upload" disabled />
                                <label htmlFor="file-upload" className="cursor-pointer">
                                    <span className="border border-solid border-zinc-400 bg-zinc-200/60 px-3 py-1.5 rounded text-xs text-zinc-700 mr-2 shadow-sm">
                                        Seleccionar archivo
                                    </span>
                                    Ningún archivo seleccionado
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* ATRIBUTS  */}
                    <div className="bg-[#f8fafc] border border-zinc-200/80 rounded p-5 flex flex-col gap-5 h-fit">

                        {/* STATUS */}
                        <div className="flex flex-col gap-1.5">
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full bg-[#64748b] text-white font-semibold px-4 py-2.5 rounded text-sm outline-none cursor-pointer"
                            >
                                <option value="New">New</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Ready for test">Ready for test</option>
                                <option value="Needs Info">Needs Info</option>
                                <option value="Rejected">Rejected</option>
                                <option value="Postponed">Postponed</option>
                                <option value="Closed">Closed</option>
                            </select>
                        </div>

                        {/* ASSIGNED TO */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Assigned To</label>
                            <select
                                name="assigned_to"
                                value={formData.assigned_to}
                                onChange={handleChange}
                                className="w-full bg-white border border-zinc-300 rounded px-3 py-2 text-sm outline-none text-zinc-700"
                            >
                                <option value="Unassigned">Unassigned</option>
                                <option value="admin">admin</option>
                                <option value="pepe">pepe</option>
                            </select>
                        </div>

                        {/* TYPE */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Type</label>
                            <select
                                name="issue_type"
                                value={formData.issue_type}
                                onChange={handleChange}
                                className="w-full bg-white border border-zinc-300 rounded px-3 py-2 text-sm outline-none text-zinc-700"
                            >
                                <option value="Bug">Bug</option>
                                <option value="Question">Question</option>
                                <option value="Enhancement">Enhancement</option>
                            </select>
                        </div>

                        {/* SEVERITY */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Severity</label>
                            <select
                                name="issue_severity"
                                value={formData.issue_severity}
                                onChange={handleChange}
                                className="w-full bg-white border border-zinc-300 rounded px-3 py-2 text-sm outline-none text-zinc-700"
                            >
                                <option value="Wishlist">Wishlist</option>
                                <option value="Minor">Minor</option>
                                <option value="Normal">Normal</option>
                                <option value="Important">Important</option>
                                <option value="Critical">Critical</option>
                            </select>
                        </div>

                        {/* PRIORITY */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Priority</label>
                            <select
                                name="priority"
                                value={formData.priority}
                                onChange={handleChange}
                                className="w-full bg-white border border-zinc-300 rounded px-3 py-2 text-sm outline-none text-zinc-700"
                            >
                                <option value="Low">Low</option>
                                <option value="Normal">Normal</option>
                                <option value="High">High</option>
                            </select>
                        </div>

                        {/* DEADLINE */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Deadline</label>
                            <input
                                type="date"
                                name="deadline"
                                value={formData.deadline}
                                onChange={handleChange}
                                className="w-full bg-white border border-zinc-300 rounded px-3 py-2 text-sm outline-none text-zinc-600 font-mono"
                            />
                        </div>

                    </div>

                    {/* ACTIONS: CREATE I CANCEL */}
                    <div className="md:col-span-3 flex flex-col items-center gap-3 mt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full h-11 text-base font-medium uppercase tracking-wider rounded transition-colors ${
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