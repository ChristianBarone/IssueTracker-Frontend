'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    fetchIssueDetail, updateIssueFields, deleteIssue,
    addComment, editComment, deleteComment,
    addWatcher, deleteWatcher
} from './detailService';
import { IssueDetailData, UserProfile } from './types';

export default function IssueDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const issueId = Number(id);

    // Hardcode del usuario actual logueado para la validación de comentarios
    const CURRENT_USER = "Andreu-Caro";

    const [issue, setIssue] = useState<IssueDetailData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<'comments' | 'activities'>('comments');

    const [newCommentBody, setNewCommentBody] = useState('');
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editingCommentBody, setEditingCommentBody] = useState('');

    const [isEditingSubject, setIsEditingSubject] = useState(false);
    const [subjectInput, setSubjectInput] = useState('');

    const [selectedUserId, setSelectedUserId] = useState<string>('');
    // cambiar
    const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([
        { id: 1, username: 'adminUser' },
        { id: 2, username: 'Andreu-Caro' },
        { id: 3, username: 'shahverdyan' },
        { id: 4, username: 'HalaAlkhatib-81' },
        { id: 5, username: 'martipiris' },
        { id: 6, username: 'ChristianAlejandroBarone' },
    ]);

    const loadData = async () => {
        if (!issueId) return;
        const data = await fetchIssueDetail(issueId);
        if (data) {
            setIssue(data);
            setSubjectInput(data.subject);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadData();
    }, [issueId]);

    const handleSaveSubject = async () => {
        if (!subjectInput.trim()) return;
        const success = await updateIssueFields(issueId, { subject: subjectInput });
        if (success) {
            setIsEditingSubject(false);
            loadData();
        }
    };

    const handlePublishComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCommentBody.trim()) return;
        const success = await addComment(issueId, newCommentBody);
        if (success) {
            setNewCommentBody('');
            loadData();
        }
    };

    const handleSaveCommentEdit = async (commentId: number) => {
        if (!editingCommentBody.trim()) return;
        const success = await editComment(commentId, editingCommentBody);
        if (success) {
            setEditingCommentId(null);
            loadData();
        }
    };

    const handleDeleteCommentClick = async (commentId: number) => {
        if (confirm("¿Segur que vols esborrar aquest comentari?")) {
            const success = await deleteComment(commentId);
            if (success) loadData();
        }
    };

    const handleDeleteIssueClick = async () => {
        if (confirm(" ¿Estas segur d'eliminar aquesta issue?")) {
            const success = await deleteIssue(issueId);
            if (success) router.push('/issues');
        }
    };

    const handleAddWatcherSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserId || !issue) return;
        const idToNumber = Number(selectedUserId);
        const userToAdd = availableUsers.find(u => u.id === idToNumber);
        if (!userToAdd) return;
        const success = await addWatcher(issueId, idToNumber);
        if (success) {
            setIssue({
                ...issue,
                watchers: [...issue.watchers, userToAdd]
            });
            setSelectedUserId('');
        } else {
            alert("No se ha podido añadir al watcher.");
        }
    };

    const handleDeleteWatcher = async (userId: number) => {
        if (!issue) return;
        const success = await deleteWatcher(issueId, userId);
        if (success) {
            loadData();
            setIssue({
                ...issue,
                watchers: issue.watchers.filter(w => w.id !== userId)
            });
        } else {
            alert("No se ha podido eliminar al watcher.");
        }
    };

    const getRelativeTimeString = (dateString: string) => {
        const commentDate = new Date(dateString);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - commentDate.getTime());
        const diffHours = Math.floor(diffTime / (1000 * 60 * 60));

        if (diffHours < 24) {
            return `${diffHours} hours ago`;
        }
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays < 7) {
            return `${diffDays} days ago`;
        }
        const weeks = Math.floor(diffDays / 7);
        const remainingDays = diffDays % 7;
        return `${weeks} week${weeks > 1 ? 's' : ''}, ${remainingDays} day${remainingDays !== 1 ? 's' : ''} ago`;
    };

    const getColorFallback = (type: string, name: string) => {
        const clean = name.toLowerCase().trim();
        if (type === 'Type') return clean === 'bug' ? '#E44057' : '#4db6ac';
        if (type === 'Severity' || type === 'Priority') {
            if (clean === 'high' || clean === 'critical') return '#E44057';
            if (clean === 'normal') return '#4db6ac';
        }
        return '#cbd5e1';
    };

    if (loading) return <div className="p-10 text-center text-zinc-400 font-medium">Loading issue data...</div>;
    if (!issue) return <div className="p-10 text-center text-red-500 font-medium">Issue not found.</div>;

    const rawType = issue.issue_type || (issue as any).type;
    const sideAttributes = [
        {
            label: 'Type',
            name: typeof rawType === 'string' ? rawType : rawType?.name || 'None',
            color: rawType?.color || getColorFallback('Type', typeof rawType === 'string' ? rawType : rawType?.name || '')
        },
        {
            label: 'Severity',
            name: typeof issue.severity === 'string' ? issue.severity : issue.severity?.name || 'None',
            color: issue.severity?.color || getColorFallback('Severity', typeof issue.severity === 'string' ? issue.severity : issue.severity?.name || '')
        },
        {
            label: 'Priority',
            name: typeof issue.priority === 'string' ? issue.priority : (issue.priority as any)?.name || 'None',
            color: (issue.priority as any)?.color || getColorFallback('Priority', typeof issue.priority === 'string' ? issue.priority : (issue.priority as any)?.name || '')
        }
    ];

    return (
        <div className="min-h-screen bg-[#f4f7f9] text-[#333] font-sans py-10 px-6">
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">

                {/* SECCIÓN IZQUIERDA*/}
                <div className="flex-1 min-w-0">

                    {/* ENCABEZADO */}
                    <div className="mb-6">
                        <Link href="/issues" className="text-[#4db6ac] hover:underline text-sm font-semibold">
                            ← Back to issues
                        </Link>

                        <div className="flex items-center gap-3 mt-3">
                            <span className="text-2xl font-bold text-zinc-400">#{issue.id}</span>
                            {isEditingSubject ? (
                                <div className="flex gap-2 flex-1">
                                    <input
                                        type="text"
                                        value={subjectInput}
                                        onChange={(e) => setSubjectInput(e.target.value)}
                                        className="w-full px-3 py-1.5 text-2xl font-bold border border-zinc-300 rounded outline-none focus:border-[#4db6ac]"
                                    />
                                    <button onClick={handleSaveSubject} className="bg-[#4db6ac] text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-[#3ca398]">Save</button>
                                    <button onClick={() => setIsEditingSubject(false)} className="bg-zinc-200 text-zinc-600 px-4 py-1.5 rounded text-sm font-medium hover:bg-zinc-300">Cancel</button>
                                </div>
                            ) : (
                                <h1 className="text-3xl font-bold text-[#2c3e50] flex items-center gap-3">
                                    {issue.subject}
                                    <span onClick={() => setIsEditingSubject(true)} className="cursor-pointer text-base text-zinc-400 hover:text-zinc-600" title="Edit Subject">✎</span>
                                </h1>
                            )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                            Created {new Date(issue.created_at).toLocaleDateString('en-GB')} | Updated {new Date(issue.modified_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>

                    {/* DESCRIPCIÓ */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200/60 mb-6">
                        <div className="mb-4">
                            <span
                                className="inline-block px-3 py-1 text-white text-xs font-bold rounded-full uppercase"
                                style={{ backgroundColor: issue.status?.color || '#4db6ac' }}
                            >
                                {issue.status?.name || 'In Progress'}
                            </span>
                        </div>

                        <h3 className="text-base font-bold text-[#2c3e50] border-b border-zinc-100 pb-2 mb-3">Description</h3>
                        <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap">
                            {issue.description || <span className="italic text-zinc-400">No description provided</span>}
                        </p>

                        {/* ATTACHMENT*/}
                        <div className="mt-6">
                            <h3 className="text-sm font-bold text-[#2c3e50] mb-3">
                                {issue.attachments?.length || 0} {(issue.attachments?.length === 1) ? 'Attachment' : 'Attachments'}
                            </h3>
                            <div className="flex flex-col gap-2">
                                {issue.attachments?.map(att => (
                                    <div key={att.id} className="flex justify-between items-center p-2.5 bg-zinc-50 rounded border border-zinc-200/80 text-sm">
                                        <a href={att.file_url} target="_blank" rel="noreferrer" className="text-[#4db6ac] hover:underline font-medium">{att.name}</a>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* COMENTARIOS / ACTIVIDADES */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200/60">
                        <div className="flex gap-6 border-b border-zinc-200 mb-6">
                            <span
                                onClick={() => setActiveTab('comments')}
                                className={`pb-2.5 cursor-pointer font-bold text-sm transition-colors ${activeTab === 'comments' ? 'text-[#4db6ac] border-b-2 border-[#4db6ac]' : 'text-zinc-400 hover:text-zinc-600'}`}
                            >
                                {issue.comments?.length || 0} Comments
                            </span>
                            <span
                                onClick={() => setActiveTab('activities')}
                                className={`pb-2.5 cursor-pointer font-bold text-sm transition-colors ${activeTab === 'activities' ? 'text-[#4db6ac] border-b-2 border-[#4db6ac]' : 'text-zinc-400 hover:text-zinc-600'}`}
                            >
                                {issue.activities?.length || 0} Activities
                            </span>
                        </div>

                        {activeTab === 'activities' ? (
                            /* PESTAÑA ACTIVIDADES */
                            <div className="flex flex-col gap-4">
                                {issue.activities?.map(act => (
                                    <div key={act.id} className="flex gap-3 text-sm">
                                        <div className="w-7 h-7 rounded-full bg-zinc-500 text-white flex items-center justify-center font-bold text-xs uppercase">
                                            {act.actor ? act.actor.slice(0,1) : 'U'}
                                        </div>
                                        <div>
                                            <div className="text-zinc-800">
                                                <strong>{act.actor}</strong> updated <span className="text-amber-600 font-semibold">{act.field_name}</span>
                                            </div>
                                            <div className="text-xs text-zinc-400 mt-0.5">
                                                {act.old_value || '-'} → {act.new_value || '-'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!issue.activities || issue.activities.length === 0) && (
                                    <p className="text-center text-sm text-zinc-400 py-4">No activities registered.</p>
                                )}
                            </div>
                        ) : (
                            /* PESTAÑA COMENTARIOS */
                            <div>
                                <form onSubmit={handlePublishComment} className="mb-6">
                                    <textarea
                                        placeholder="Write something..."
                                        value={newCommentBody}
                                        onChange={(e) => setNewCommentBody(e.target.value)}
                                        rows={3}
                                        className="w-full p-3 border border-zinc-200 rounded-md resize-none outline-none focus:border-zinc-400 text-sm placeholder-zinc-400"
                                        required
                                    />
                                    <div className="text-right mt-2">
                                        <button type="submit" className="bg-[#4db6ac] text-white px-5 py-2 rounded font-bold text-xs tracking-wider uppercase hover:bg-[#3ca398] transition-colors">
                                            PUBLISH
                                        </button>
                                    </div>
                                </form>

                                {/* LISTA DE COMENTARIOS */}
                                <div className="flex flex-col gap-4">
                                    {issue.comments?.map(com => {
                                        // Limpiamos los nombres quitando espacios y el símbolo '@'
                                        const cleanAuthor = com.author?.replace('@', '').trim().toLowerCase() || '';
                                        const cleanCurrentUser = CURRENT_USER.replace('@', '').trim().toLowerCase();

                                        // Si el autor del comentario coincide con el usuario activo, activamos los permisos
                                        const isMyComment = cleanAuthor === cleanCurrentUser;

                                        return (
                                            <div key={com.id} className="p-4 border border-zinc-100 rounded-md bg-zinc-50/30">
                                                <div className="flex items-center gap-2 text-xs mb-2">
                                                    <span className="text-[#4db6ac] font-bold">@{com.author?.replace('@', '')}</span>
                                                    <span className="text-zinc-400">{getRelativeTimeString(com.created_at)}</span>
                                                </div>

                                                {editingCommentId === com.id ? (
                                                    <div>
                                                        <textarea
                                                            value={editingCommentBody}
                                                            onChange={(e) => setEditingCommentBody(e.target.value)}
                                                            className="w-full p-2 border border-zinc-300 rounded text-sm outline-none focus:border-zinc-400"
                                                            rows={2}
                                                        />
                                                        <div className="mt-2 flex gap-3 justify-end items-center">
                                                            <span onClick={() => setEditingCommentId(null)} className="cursor-pointer text-zinc-400 hover:text-zinc-600 text-xs font-medium">Cancelar</span>
                                                            <button onClick={() => handleSaveCommentEdit(com.id)} className="bg-[#4db6ac] text-white px-3 py-1 rounded text-xs font-bold hover:bg-[#3ca398]">GUARDAR</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-sm text-zinc-700 whitespace-pre-wrap">{com.body}</p>

                                                        {/* Botones visibles únicamente para el dueño real del comentario */}
                                                        {isMyComment && (
                                                            <div className="mt-3 flex gap-4 text-xs font-bold border-t border-zinc-100 pt-2">
                                                                <span onClick={() => { setEditingCommentId(com.id); setEditingCommentBody(com.body); }} className="text-[#4db6ac] cursor-pointer hover:underline">Editar</span>
                                                                <span onClick={() => handleDeleteCommentClick(com.id)} className="text-red-500 cursor-pointer hover:underline">Eliminar</span>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        );
                                    })}
                                    {(!issue.comments || issue.comments.length === 0) && (
                                        <p className="text-center text-sm text-zinc-400 py-4">No comments yet.</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* BARRA LATERAL DERECHA (DETAILS) */}
                <div className="w-full lg:w-80 flex-shrink-0 bg-white p-5 rounded-lg shadow-sm border border-zinc-200/60 h-fit">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">DETAILS</h4>

                    {sideAttributes.map(attr => (
                        <div key={attr.label} className="flex justify-between items-center py-3 border-b border-zinc-100 text-sm">
                            <span className="text-zinc-400">{attr.label}</span>
                            <span className="font-semibold text-zinc-700 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: attr.color }} />
                                {attr.name}
                            </span>
                        </div>
                    ))}

                    <div className="flex justify-between items-center py-3 border-b border-zinc-100 text-sm">
                        <span className="text-zinc-400">Deadline</span>
                        <span className="font-semibold text-zinc-700">
                            {issue.deadline ? new Date(issue.deadline).toLocaleDateString('en-GB') : 'No date'}
                        </span>
                    </div>

                    <div className="flex justify-between items-center py-3 border-b border-zinc-100 text-sm">
                        <span className="text-zinc-400">Creator</span>
                        <span className="font-bold text-zinc-700">
                            {issue.creator?.username ? `@${issue.creator.username}` : '@unknown'}
                        </span>
                    </div>

                    <div className="flex justify-between items-center py-3 border-b border-zinc-100 text-sm">
                        <span className="text-zinc-400">Assigned</span>
                        <span className="font-semibold text-zinc-700">
                            {issue.assignee?.username ? `@${issue.assignee.username}` : 'Unassigned'}
                        </span>
                    </div>

                    <div className="mt-4 border-b border-zinc-100 pb-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                            WATCHERS ({issue.watchers?.length || 0})
                        </h4>

                        {/* Lista de watchers actuales */}
                        <ul className="mb-4 flex flex-col gap-2">
                            {issue.watchers?.map((watcherOrId, index) => {
                                // 1. Si el backend te da un número, buscamos el objeto completo en 'availableUsers'
                                // Si ya te da un objeto, usamos ese objeto directamente.
                                const watcherFullData = typeof watcherOrId === 'number'
                                    ? availableUsers.find(u => u.id === watcherOrId)
                                    : watcherOrId;

                                // 2. Si no lo encuentra en ningún lado, creamos un objeto vacío de respaldo
                                const watcher = watcherFullData || { id: watcherOrId, username: 'unknown' };

                                return (
                                    <li key={`${watcher.id}-${index}`} className="flex justify-between items-center text-sm bg-zinc-50 p-2 rounded border border-zinc-100">
                                        <div className="flex items-center gap-2">
                                            {watcher.avatar_url ? (
                                                <img className="w-6 h-6 rounded-full object-cover" src={watcher.avatar_url} alt="N/A" />
                                            ) : (
                                                <span className="w-6 h-6 rounded-full bg-[#4db6ac] text-white flex items-center justify-center text-[10px] font-bold uppercase">
                                                    {(watcher.username?.slice(0, 2) || '??')}
                                                </span>
                                            )}
                                            <span className="text-zinc-700 font-medium text-xs">@{watcher.username || 'unknown'}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveWatcher(watcher.id)}
                                            className="text-zinc-400 hover:text-red-500 font-bold transition-colors text-xs px-1"
                                        >
                                            ✕
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>

                        {/* Formulario selector */}
                        <form onSubmit={handleAddWatcherSubmit} className="flex gap-1">
                            <select
                                name="user_id"
                                value={selectedUserId}
                                onChange={(e) => setSelectedUserId(e.target.value)}
                                className="flex-1 bg-white border border-zinc-200 rounded text-xs p-2 outline-none focus:border-zinc-400 text-zinc-600"
                            >
                                <option value="">Add user...</option>
                                {availableUsers.map((user) => (
                                    <option key={user.id} value={user.id}>
                                        {user.username}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="submit"
                                className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-3 py-1.5 rounded text-sm font-bold hover:bg-zinc-200 active:bg-zinc-300 transition-colors"
                            >
                                +
                            </button>
                        </form>
                    </div>

                    <div className="mt-8">
                        <button
                            onClick={handleDeleteIssueClick}
                            className="w-full py-2.5 bg-white text-red-500 border border-red-500 rounded font-bold text-xs tracking-wider uppercase transition-all hover:bg-red-500 hover:text-white cursor-pointer"
                        >
                            DELETE ISSUE
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}