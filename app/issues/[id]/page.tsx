'use client';

import React, {useState, useEffect, useRef} from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    fetchIssueDetail, updateIssueFields, updateIssueAssignee, deleteIssue,
    addComment, editComment, deleteComment, deleteAttachment, addAttachment,
    addWatcher, deleteWatcher
} from './detailService';
import { IssueDetailData } from './types';
import { AUTH_USERS, getStoredUsername, getUserIdByUsername, getUserById } from '../../lib/auth';

export default function IssueDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const issueId = Number(id);

    const fileRef = useRef<HTMLInputElement>(null);

    const [issue, setIssue] = useState<IssueDetailData | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [uploading, setUploading] = useState<boolean>(false);
    const [activeTab, setActiveTab] = useState<'comments' | 'activities'>('comments');
    const [currentUser, setCurrentUser] = useState<string | null>(() => getStoredUsername() ?? null);

    const [newCommentBody, setNewCommentBody] = useState('');
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editingCommentBody, setEditingCommentBody] = useState('');

    const [isEditingSubject, setIsEditingSubject] = useState(false);
    const [subjectInput, setSubjectInput] = useState('');
    const [isSavingAssignee, setIsSavingAssignee] = useState(false);
    const [assigneeMessage, setAssigneeMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([
        { id: 1, username: 'adminUser' },
        { id: 2, username: 'Marti-Piris' },
        { id: 3, username: 'Andreu-Caro' },
        { id: 4, username: 'Hala-Alkhatib' },
        { id: 5, username: 'Aleks-Shahverdyan' },
        { id: 6, username: 'Christian-Alejandro-Barone' },
    ]);

    const loadData = async () => {
        if (!issueId) return;
        const data = await fetchIssueDetail(issueId);
        if (data) {
            // If backend returned an assignee object without a numeric id, try to map it to our local users
            if (data.assignee && typeof data.assignee === 'object' && Number(data.assignee.id) === 0) {
                const assigneeUsername = 'username' in data.assignee ? String(data.assignee.username || '') : '';
                const possibleId = getUserIdByUsername(assigneeUsername);
                if (possibleId != null) {
                    data.assignee = getUserById(possibleId) ?? { id: possibleId, username: assigneeUsername };
                }
            }

            setIssue(data);
            setSubjectInput(data.subject);
        }
        setLoading(false);
    };

    useEffect(() => {
        let cancelled = false;
        if (issueId) {
            queueMicrotask(() => {
                if (!cancelled) {
                    void loadData();
                }
            });
        }
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [issueId]);

    useEffect(() => {
        const onStorage = () => {
            const nextUser = getStoredUsername() ?? null;
            setCurrentUser(nextUser);
        };

        globalThis.addEventListener('storage', onStorage);
        return () => globalThis.removeEventListener('storage', onStorage);
    }, []);

    const handleSaveSubject = async () => {
        if (!subjectInput.trim()) return;
        const success = await updateIssueFields(issueId, { subject: subjectInput });
        if (success) {
            setIsEditingSubject(false);
            await loadData();
        }
    };

    const handlePublishComment = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!newCommentBody.trim()) return;
        const success = await addComment(issueId, newCommentBody);
        if (success) {
            setNewCommentBody('');
            await loadData();
        }
    };

    const handleSaveCommentEdit = async (commentId: number) => {
        if (!editingCommentBody.trim()) return;
        const success = await editComment(commentId, editingCommentBody);
        if (success) {
            setEditingCommentId(null);
            await loadData();
        }
    };

    const handleDeleteCommentClick = async (commentId: number) => {
        if (confirm("Are you sure you want to delete this comment?")) {
            const success = await deleteComment(commentId);
            if (success) await loadData();
        }
    };

    const handleDeleteIssueClick = async () => {
        if (confirm("Are you sure you want to delete this issue?")) {
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
            await loadData();
        } else {
            alert("No se ha podido eliminar al watcher.");
        }
    };

    const handleAssigneeSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const nextValue = e.target.value;
        setIsSavingAssignee(true);
        setAssigneeMessage(null);
        const result = await updateIssueAssignee(issueId, nextValue ? Number(nextValue) : null);
        if (result.ok) {
            // Optimistic UI: use local mapping so the select shows the new assignee
            const newId = nextValue ? Number(nextValue) : null;
            if (newId != null) {
                setIssue(prev => prev ? { ...prev, assignee: getUserById(newId) ?? { id: newId, username: AUTH_USERS.find(u=>u.id===newId)?.username ?? '' } } : prev);
            } else {
                setIssue(prev => prev ? { ...prev, assignee: null } : prev);
            }
            await loadData();
            setAssigneeMessage({ text: 'Assignee updated.', isError: false });
        } else {
            const detail = result.status ? ` (${result.status})` : '';
            setAssigneeMessage({ text: `${result.message || 'Could not update assignee'}${detail}`, isError: true });
        }
        setIsSavingAssignee(false);
    };

    const handleAssignToMe = async () => {
        if (!currentUser) return;
        const myId = getUserIdByUsername(currentUser);
        if (myId == null) return;

        setIsSavingAssignee(true);
        setAssigneeMessage(null);
        const result = await updateIssueAssignee(issueId, myId);
        if (result.ok) {
            // Optimistic UI update: set local assignee to our known user so UI reflects it even if profile endpoints are flaky
            setIssue(prev => prev ? { ...prev, assignee: getUserById(myId) ?? { id: myId, username: getUserById(myId)?.username ?? '' } } : prev);
            await loadData();
            setAssigneeMessage({ text: 'Assigned to you.', isError: false });
        } else {
            const detail = result.status ? ` (${result.status})` : '';
            setAssigneeMessage({ text: `${result.message || 'Could not assign to you'}${detail}`, isError: true });
        }
        setIsSavingAssignee(false);
    };

    const handleAddAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
        try {
            setUploading(true);
            const body = new FormData();
            let success = false;

            if (e.target.type === 'file' && e.target.files) {
                const files = Array.from(e.target.files)

                files.forEach(file => {
                    body.append('files', file)
                })
            }
            else return

            if (issue !== null) {
                success = await addAttachment(issue.id, body)
            }

            if (success) await loadData();
        } catch {
            console.log('Error de connexió amb el Back-End.');
        } finally {
            setUploading(false);
        }
    }

    const handleDeleteAttachmentClick= async (attachmentId: number) => {
        const success = await deleteAttachment(attachmentId)
        if (success) await loadData();
    }

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
        return `${weeks} week${weeks > 1 ? 's' : ''}, ${remainingDays} day${remainingDays === 1 ? '' : 's'} ago`;
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

    const getActivityLabel = (fieldName: string | undefined | null, oldValue: string | null, newValue: string | null) => {
        const field = String(fieldName ?? '').toLowerCase();

        if (!field) return 'updated this issue';

        if (field === 'issue') return 'created this issue';
        if (field === 'assignee') return 'changed the assignee';
        if (field === 'watchers') {
            if (newValue?.toLowerCase().startsWith('added ')) return `added ${newValue.slice(6)}`;
            if (oldValue?.toLowerCase().startsWith('removed ')) return `removed ${oldValue.slice(8)}`;
            return 'updated watchers';
        }
        if (field === 'tags') {
            if (newValue?.toLowerCase().startsWith('added ')) return `added tags: ${newValue.slice(6)}`;
            if (oldValue?.toLowerCase().startsWith('removed ')) return `removed tags: ${oldValue.slice(8)}`;
            return 'updated tags';
        }
        if (field === 'comments') {
            const next = (newValue || '').toLowerCase();
            const prev = (oldValue || '').toLowerCase();
            if (next.startsWith('added comment:')) return 'added a comment';
            if (next.startsWith('edited to:') || prev.startsWith('edited from:')) return 'edited a comment';
            if (prev.startsWith('deleted comment:')) return 'deleted a comment';
            return 'updated comments';
        }
        if (field === 'subject') return 'changed the subject';
        if (field === 'description') return 'changed the description';
        if (field === 'status') return 'changed the status';
        if (field === 'type') return 'changed the type';
        if (field === 'severity') return 'changed the severity';
        if (field === 'priority') return 'changed the priority';
        if (field === 'deadline') return 'changed the deadline';

        return `updated ${fieldName}`;
    };

    const getActivityUser = (activity: { actor?: string; user?: string }) => {
        return activity.actor || activity.user || 'System';
    };

    const getActivityField = (activity: { field_name?: string; field?: string }) => {
        return activity.field_name || activity.field || '';
    };

    const getActivityOldValue = (activity: { old_value?: string | null; old?: string | null }) => {
        return activity.old_value ?? activity.old ?? null;
    };

    const getActivityNewValue = (activity: { new_value?: string | null; new?: string | null }) => {
        return activity.new_value ?? activity.new ?? null;
    };

    if (loading) return <div className="p-10 text-center text-zinc-400 font-medium">Loading issue data...</div>;
    if (!issue) return <div className="flex flex-col gap-5 p-10 text-center text-red-500 font-medium">
        Issue not found.
        <Link href="/issues" className="text-[#4db6ac] hover:underline text-sm font-semibold">
            ← Back to issues
        </Link>
    </div>;

    const issueExt = issue as unknown as {
        type?: { name?: string; color?: string };
        priority?: { name?: string; color?: string };
        tags?: Array<{ id: number; name: string } | string>;
        watchers?: Array<{ id: number; username: string } | string>;
    };

    const rawType = issue.issue_type || issueExt.type;

    const sideAttributes = [
        {
            label: 'Type',
            name: typeof rawType === 'string' ? rawType : rawType?.name || 'None',
            color: (typeof rawType !== 'string' && rawType?.color) || getColorFallback('Type', typeof rawType === 'string' ? rawType : rawType?.name || '')
        },
        {
            label: 'Severity',
            name: typeof issue.severity === 'string' ? issue.severity : issue.severity?.name || 'None',
            color: (typeof issue.severity !== 'string' && issue.severity?.color) || getColorFallback('Severity', typeof issue.severity === 'string' ? issue.severity : issue.severity?.name || '')
        },
        {
            label: 'Priority',
            name: typeof issue.priority === 'string' ? issue.priority : (issue.priority as typeof issueExt.priority)?.name || 'None',
            color: (typeof issue.priority !== 'string' && (issue.priority as typeof issueExt.priority)?.color) || getColorFallback('Priority', typeof issue.priority === 'string' ? issue.priority : (issue.priority as typeof issueExt.priority)?.name || '')
        }
    ];

    let creatorName = 'unknown';
    if (issue.creator) {
        if (typeof issue.creator === 'string') creatorName = issue.creator;
        else if (typeof issue.creator === 'object' && 'username' in issue.creator) creatorName = (issue.creator as { username: string }).username;
    }

    let assigneeName = 'Unassigned';
    if (issue.assignee) {
        if (typeof issue.assignee === 'string') assigneeName = issue.assignee;
        else if (typeof issue.assignee === 'object' && 'username' in issue.assignee) assigneeName = (issue.assignee as { username: string }).username;
    }

    const currentTags = issueExt.tags || [];
    const currentWatchers = issueExt.watchers || [];

    const cleanCreator = creatorName.replace('@', '').trim().toLowerCase();
    const cleanCurrentUser = (currentUser ?? '').replace('@', '').trim().toLowerCase();
    const isMyIssue = currentUser && cleanCreator === cleanCurrentUser;
    const currentAssigneeValue = (() => {
        if (!issue.assignee) return '';

        // If server already returned an object with numeric id, use it.
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const asAny: any = issue.assignee;
            if (asAny && typeof asAny === 'object' && Number.isFinite(asAny.id) && asAny.id > 0) {
                return String(asAny.id);
            }
            // Fallback: try to extract username if it's a string or object without id
            const rawUsername = (typeof issue.assignee === 'string') ? issue.assignee : (issue.assignee.username ?? '');
            const username = String(rawUsername).replace('@', '').trim();
            if (!username || username.toLowerCase() === 'unassigned') return '';
            const fallbackId = getUserIdByUsername(username);
            return fallbackId == null ? '' : String(fallbackId);
        } catch (err) {
            console.debug('Error computing currentAssigneeValue', err);
            return '';
        }
    })();
    try { console.debug('[page] assignee raw:', issue.assignee, '-> currentAssigneeValue:', currentAssigneeValue); } catch {}
    const canAssignToMe = !!currentUser && assigneeName.replace('@', '').trim().toLowerCase() !== cleanCurrentUser;

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
                                    <button onClick={handleSaveSubject} className="bg-[#4db6ac] text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-[#3ca398] cursor-pointer">Save</button>
                                    <button onClick={() => setIsEditingSubject(false)} className="bg-zinc-200 text-zinc-600 px-4 py-1.5 rounded text-sm font-medium hover:bg-zinc-300 cursor-pointer">Cancel</button>
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

                    {/* DESCRIPCIÓN */}
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
                            <div className="mb-4 flex justify-left items-center gap-3">
                                <h3 className="text-lg font-bold text-[#2c3e50]">
                                    {issue.attachments?.length || 0} {(issue.attachments?.length === 1) ? 'Attachment' : 'Attachments'}
                                </h3>
                                <button onClick={() => fileRef.current?.click()} className="flex align-center justify-center w-7 h-7 font-bold bg-[#5dc5b5] text-white cursor-pointer rounded-sm">+</button>
                                <input ref={fileRef} type="file" onChange={handleAddAttachment} hidden></input>
                                <h2 className="text-sm text-[#2c3e50]">{uploading ? "Uploading..." : ""}</h2>
                            </div>
                            {issue.attachments?.length === 0 ?
                                ''
                                : <div
                                    className="flex flex-col gap-2 p-2.5 bg-zinc-50 rounded border border-zinc-200/80 text-sm">
                                    {issue.attachments?.map(att => (
                                        <div key={att.id} className="flex flex-row justify-between items-center">
                                            <a href={att.url} target="_blank" rel="noreferrer"
                                               className="text-[#4db6ac] hover:underline font-medium cursor-pointer">{att.name}</a>
                                            {att.creator_id == getUserIdByUsername(currentUser ?? '') ?
                                                <button onClick={() => handleDeleteAttachmentClick(att.id)}
                                                        className="cursor-pointer w-7.75 border-2 border-red-500 text-red-500 font-bold p-1 transition duration-200 hover:bg-red-500 hover:text-white">X
                                                </button>
                                            : ''}
                                        </div>
                                    ))}
                                </div>
                            }
                        </div>
                    </div>

                    {/* COMENTARIOS / ACTIVIDADES */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200/60">
                        <div className="flex gap-6 border-b border-zinc-200 mb-6">
                            <button
                                onClick={() => setActiveTab('comments')}
                                className={`pb-2.5 cursor-pointer font-bold text-sm transition-colors ${activeTab === 'comments' ? 'text-[#4db6ac] border-b-2 border-[#4db6ac]' : 'text-zinc-400 hover:text-zinc-600'}`}
                            >
                                {issue.comments?.length || 0} Comments
                            </button>
                            <button
                                onClick={() => setActiveTab('activities')}
                                className={`pb-2.5 cursor-pointer font-bold text-sm transition-colors ${activeTab === 'activities' ? 'text-[#4db6ac] border-b-2 border-[#4db6ac]' : 'text-zinc-400 hover:text-zinc-600'}`}
                            >
                                {issue.activities?.length || 0} Activities
                            </button>
                        </div>

                        {activeTab === 'activities' ? (
                            /* PESTAÑA ACTIVIDADES */
                            <div className="flex flex-col gap-4">
                                {issue.activities?.map(act => (
                                    <div key={act.id} className="flex gap-3 text-sm">
                                        <div className="w-7 h-7 rounded-full bg-zinc-500 text-white flex items-center justify-center font-bold text-xs uppercase">
                                            {getActivityUser(act).slice(0, 1)}
                                        </div>
                                        <div>
                                            <div className="text-zinc-800">
                                                <strong>{getActivityUser(act)}</strong> {getActivityLabel(getActivityField(act), getActivityOldValue(act), getActivityNewValue(act))}
                                            </div>
                                            <div className="text-xs text-zinc-400 mt-0.5">
                                                {getActivityOldValue(act) || '-'} → {getActivityNewValue(act) || '-'}
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
                                        <button type="submit" className="bg-[#4db6ac] text-white px-5 py-2 rounded font-bold text-xs tracking-wider uppercase hover:bg-[#3ca398] transition-colors cursor-pointer">
                                            PUBLISH
                                        </button>
                                    </div>
                                </form>

                                {/* LISTA DE COMENTARIOS */}
                                <div className="flex flex-col gap-4">
                                    {issue.comments?.map(com => {
                                        const cleanAuthor = com.author?.replace('@', '').trim().toLowerCase() || '';
                                        const cleanCurrentUser = (currentUser ?? '').replace('@', '').trim().toLowerCase();
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
                                                            <button onClick={() => { setEditingCommentId(null); }} className="cursor-pointer text-zinc-400 hover:text-zinc-600 text-xs font-medium">Cancelar</button>
                                                            <button onClick={() => handleSaveCommentEdit(com.id)} className="cursor-pointer bg-[#4db6ac] text-white px-3 py-1 rounded text-xs font-bold hover:bg-[#3ca398]">GUARDAR</button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-sm text-zinc-700 whitespace-pre-wrap">{com.body}</p>

                                                        {isMyComment && (
                                                            <div className="mt-3 flex gap-4 text-xs font-bold border-t border-zinc-100 pt-2">
                                                                <button onClick={() => { setEditingCommentId(com.id); setEditingCommentBody(com.body); }} className="text-[#4db6ac] cursor-pointer hover:underline">Editar</button>
                                                                <button onClick={() => handleDeleteCommentClick(com.id)} className="text-red-500 cursor-pointer hover:underline">Eliminar</button>
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
                <div className="w-full lg:w-80 shrink-0 bg-white p-5 rounded-lg shadow-sm border border-zinc-200/60 h-fit">
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
                            @{creatorName.replace('@', '')}
                        </span>
                    </div>

                    <div className="flex justify-between items-center py-3 border-b border-zinc-100 text-sm">
                        <span className="text-zinc-400">Assigned</span>
                        <div className="flex flex-col items-end gap-2">
                            <select
                                value={currentAssigneeValue}
                                onChange={handleAssigneeSelectChange}
                                disabled={isSavingAssignee}
                                className="text-xs px-2 py-1.5 border border-zinc-200 rounded outline-none bg-zinc-50/50 text-zinc-700"
                            >
                                <option value="">Unassigned</option>
                                {AUTH_USERS.map((user) => (
                                    <option key={user.id} value={String(user.id)}>{user.username}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleAssignToMe}
                                disabled={!canAssignToMe || isSavingAssignee}
                                className="bg-zinc-100 text-zinc-700 border border-zinc-300 hover:bg-zinc-200 text-xs font-bold px-2.5 py-1.5 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Assign to me
                            </button>
                            {assigneeMessage && (
                                <span className={`text-[11px] ${assigneeMessage.isError ? 'text-red-500' : 'text-emerald-600'}`}>
                                    {assigneeMessage.text}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* REPARADO: SECCIÓN DE TAGS */}
                    <div className="mt-6 pt-4 border-t border-zinc-100">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">TAGS</h4>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            {currentTags.map((tag, idx) => {
                                const tagName = typeof tag === 'string' ? tag : tag.name;
                                return (
                                    <span key={typeof tag === 'string' ? idx : tag.id} className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-xs font-medium border border-zinc-200/60">
                                        {tagName}
                                    </span>
                                );
                            })}
                            {currentTags.length === 0 && <span className="text-xs text-zinc-400 italic">No tags</span>}
                        </div>
                        <div className="flex gap-1">
                            <select className="flex-1 text-xs px-2 py-1.5 border border-zinc-200 rounded outline-none bg-zinc-50/50 text-zinc-600">
                                <option>Test tag</option>
                            </select>
                            <button className="bg-[#4db6ac] text-white text-xs font-bold px-3 py-1 rounded hover:bg-[#3ca398]">+ Add</button>
                        </div>
                    </div>
                    <div className="mt-4 border-b border-zinc-100 pb-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                            WATCHERS ({issue.watchers?.length || 0})
                        </h4>

                        {/* Lista de watchers actuales */}
                        <ul className="mb-4 flex flex-col gap-2">
                            {issue.watchers?.map((watcher: any, index) => {
                                // Como ya vienen normalizados del servicio, 'watcher' siempre tendrá id y username válidos
                                return (
                                    <li key={`${watcher.id}-${index}`} className="flex justify-between items-center text-sm bg-zinc-50 p-2 rounded border border-zinc-100">
                                        <div className="flex items-center gap-2">
                                            {watcher.avatar_url ? (
                                                <img className="w-6 h-6 rounded-full object-cover" src={watcher.avatar_url} alt="Avatar" />
                                            ) : (
                                                <span className="w-6 h-6 rounded-full bg-[#4db6ac] text-white flex items-center justify-center text-[10px] font-bold uppercase">
                                                    {(watcher.username?.slice(0, 2) || '??')}
                                                </span>
                                            )}
                                            <span className="text-zinc-700 font-medium text-xs">@{watcher.username || 'unknown'}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteWatcher(watcher.id)}
                                            className="text-zinc-400 hover:text-red-500 font-bold transition-colors text-xs px-1 cursor-pointer"
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

                    {/* EL BOTÓN SOLO SE RENDERIZA SI EL USUARIO LOGUEADO ES EL CREADOR */}
                    {isMyIssue && (
                        <div className="mt-8">
                            <button
                                onClick={handleDeleteIssueClick}
                                className="w-full py-2.5 bg-white text-red-500 border border-red-500 rounded font-bold text-xs tracking-wider uppercase transition-all hover:bg-red-500 hover:text-white cursor-pointer"
                            >
                                DELETE ISSUE
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}