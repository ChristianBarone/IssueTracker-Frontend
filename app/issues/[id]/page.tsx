'use client';

import Image from 'next/image';
import React, {useState, useEffect, useRef, useMemo} from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    fetchIssueDetail, updateIssueFields, updateIssueAssignee, deleteIssue,
    addComment, editComment, deleteComment, deleteAttachment, addAttachment,
    addWatcher, deleteWatcher
} from './detailService';
import { IssueDetailData } from './types';
import { AUTH_USERS, getStoredUsername, getStoredApiKey, getUserIdByUsername, getUserById } from '../../lib/auth';
import { fetchEntities, AnyEntity } from '../../settings/settingsService';
import { fetchProfile } from '../../profile/profileService';
import {AssigneeDropdown} from "@/app/components/Dropdown";

export default function IssueDetailPage() {
    const { id } = useParams();
    const router = useRouter();
    const issueId = Number(id);

    const fileRef = useRef<HTMLInputElement>(null);

    const [issue, setIssue] = useState<IssueDetailData | null>(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [activeTab, setActiveTab] = useState<'comments' | 'activities'>('comments');
    const [currentUser, setCurrentUser] = useState<string | null>(() => getStoredUsername() ?? null);

    const [newCommentBody, setNewCommentBody] = useState('');
    const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
    const [editingCommentBody, setEditingCommentBody] = useState('');

    const [isEditingSubject, setIsEditingSubject] = useState(false);
    const [subjectInput, setSubjectInput] = useState('');
    const [subjectError, setSubjectError] = useState('');
    const [isSavingAssignee, setIsSavingAssignee] = useState(false);
    const [assigneeMessage, setAssigneeMessage] = useState<{ text: string; isError: boolean } | null>(null);

    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [availableUsers, setAvailableUsers] = useState(AUTH_USERS);
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [descriptionInput, setDescriptionInput] = useState('');

    const [isEditingDeadline, setIsEditingDeadline] = useState(false);
    const [deadlineInput, setDeadlineInput] = useState('');

    const [types, setTypes] = useState<AnyEntity[]>([]);
    const [severities, setSeverities] = useState<AnyEntity[]>([]);
    const [priorities, setPriorities] = useState<AnyEntity[]>([]);
    const [statuses, setStatuses] = useState<AnyEntity[]>([]);
    const [allTags, setAllTags] = useState<AnyEntity[]>([]);
    const [userAvatars, setUserAvatars] = useState<Record<string, string | null>>({});

    const [openPicker, setOpenPicker] = useState<string | null>(null);

    const loadData = async () => {
        if (!issueId) return;
        const data = await fetchIssueDetail(issueId);
        if (data) {
            setIssue(data);
            setSubjectInput(data.subject);
            setDescriptionInput(data.description || '');
        }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [issueId]);

    useEffect(() => {
        const loadEntities = async () => {
            const apiKey = getStoredApiKey();
            if (!apiKey) return;
            try {
                const [typeList, severityList, priorityList, statusList, tagList] = await Promise.all([
                    fetchEntities('types', apiKey),
                    fetchEntities('severities', apiKey),
                    fetchEntities('priorities', apiKey),
                    fetchEntities('statuses', apiKey),
                    fetchEntities('tags', apiKey),
                ]);
                setTypes(typeList);
                setSeverities(severityList);
                setPriorities(priorityList);
                setStatuses(statusList);
                setAllTags(tagList);
            } catch (err) {
                console.error('Error loading entities:', err);
            }
        };
        loadEntities();
    }, []);

    useEffect(() => {
        const storedUser = getStoredUsername();
        setCurrentUser(storedUser);
        const onStorage = () => setCurrentUser(getStoredUsername());
        globalThis.addEventListener('storage', onStorage);
        return () => globalThis.removeEventListener('storage', onStorage);
    }, []);

    // Actualizar availableUsers cuando issue carga
    useEffect(() => {
        if (issue) {
            setAvailableUsers(AUTH_USERS.filter((user) => !issue.watchers.includes(user.username)));
        }
    }, [issue]);

    const isCreator = !!(issue && currentUser &&
        currentUser.replace('@', '').trim().toLowerCase() ===
        issue.creator?.replace('@', '').trim().toLowerCase()
    );

    const findColor = (options: AnyEntity[], name: string): string => {
        const match = options.find(o => o.name.toLowerCase() === (name || '').toLowerCase());
        return match?.color ?? '#cbd5e1';
    };

    // Enrich issue tags: look up by id first, then by name as fallback (API may return id=0)
    const enrichedTags = useMemo(() => {
        if (!issue) return [];
        return issue.tags.map(tag => {
            if (tag.id > 0 && tag.name && tag.color) return tag;
            const found = (tag.id > 0 ? allTags.find(t => t.id === tag.id) : undefined)
                       ?? (tag.name ? allTags.find(t => t.name === tag.name) : undefined);
            return found ? { id: found.id, name: found.name, color: found.color } : tag;
        });
    }, [issue, allTags]);

    const handleSaveSubject = async () => {
        if (!subjectInput.trim()) {
            setSubjectError('Subject cannot be empty');
            return;
        }
        const success = await updateIssueFields(issueId, { subject: subjectInput.trim() });
        if (success) {
            setIsEditingSubject(false);
            setSubjectError('');
            loadData();
        }
    };

    const handleSelectOption = async (fieldKey: string, optionId: number) => {
        const success = await updateIssueFields(issueId, { [fieldKey]: optionId });
        if (success) {
            setOpenPicker(null);
            loadData();
        }
    };

    const handleSaveDescription = async () => {
        const success = await updateIssueFields(issueId, { description: descriptionInput });
        if (success) {
            setIsEditingDescription(false);
            loadData();
        }
    };

    const handleSaveDeadline = async (value: string | null) => {
        const success = await updateIssueFields(issueId, { deadline: value });
        if (success) {
            setIsEditingDeadline(false);
            loadData();
        }
    };

    const handleRemoveTag = async (tagId: number) => {
        if (!issue) return;
        const newTagIds = enrichedTags
            .filter(t => t.id !== tagId)
            .map(t => t.id)
            .filter((id): id is number => id > 0);
        const success = await updateIssueFields(issueId, { tags: newTagIds });
        if (success) loadData();
    };

    const handleAddTag = async (tagId: number) => {
        if (!issue) return;
        const currentIds = enrichedTags
            .map(t => t.id)
            .filter((id): id is number => typeof id === 'number' && id > 0);
        if (currentIds.includes(tagId)) return;
        const payload = [...currentIds, tagId];
        const success = await updateIssueFields(issueId, { tags: payload });
        if (success) {
            setOpenPicker(null);
            loadData();
        }
    };

    const handlePublishComment = async (e: React.FormEvent<HTMLFormElement>) => {
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
        if (confirm('Are you sure you want to delete this comment?')) {
            const success = await deleteComment(commentId);
            if (success) await loadData();
        }
    };

    const handleDeleteIssueClick = async () => {
        if (confirm('Are you sure you want to delete this issue?')) {
            const success = await deleteIssue(issueId);
            if (success) router.push('/issues');
        }
    };

    const handleAddWatcherSubmit = async (e: React.SubmitEvent) => {
        e.preventDefault();
        if (!selectedUserId || !issue) return;
        const idToNumber = Number(selectedUserId);
        const userToAdd = availableUsers.find(u => u.id === idToNumber)?.username;
        if (!userToAdd) return;
        const success = await addWatcher(issueId, idToNumber);
        if (success) {
            setSelectedUserId('');
            await loadData();
            setAvailableUsers(availableUsers.filter((user) => user.username !== userToAdd))
        } else {
            alert("No se ha podido añadir al watcher.");
        }
    };

    const handleDeleteWatcher = async (userId: number) => {
        if (!issue) return;
        const success = await deleteWatcher(issueId, userId);
        if (success) {
            const newUsers = Array.from(availableUsers)
            const user = AUTH_USERS.find(user => user.id === userId)
            if (user) newUsers.push(user)

            setAvailableUsers(newUsers)
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
            const newId = nextValue ? Number(nextValue) : null;
            if (newId != null) {
                setIssue(prev => prev ? { ...prev, assignee: getUserById(newId)?.username ?? '' } : prev);
            } else {
                setIssue(prev => prev ? { ...prev, assignee: '' } : prev);
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
            setIssue(prev => prev ? { ...prev, assignee: getUserById(myId)?.username ?? '' } : prev);
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
                const files = Array.from(e.target.files);
                files.forEach(file => { body.append('files', file); });
            } else return;

            if (issue !== null) {
                success = await addAttachment(issue.id, body);
            }

            if (success) await loadData();
        } catch {
            console.log('Error de connexió amb el Back-End.');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteAttachmentClick = async (attachmentId: number) => {
        const success = await deleteAttachment(attachmentId);
        if (success) await loadData();
    };

    const getRelativeTimeString = (dateString: string) => {
        const diffMs = Math.abs(Date.now() - new Date(dateString).getTime());
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        if (diffHours < 24) return `${diffHours} hours ago`;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays < 7) return `${diffDays} days ago`;
        const weeks = Math.floor(diffDays / 7);
        const remainingDays = diffDays % 7;
        return `${weeks} week${weeks > 1 ? 's' : ''}, ${remainingDays} day${remainingDays === 1 ? '' : 's'} ago`;
    };

    const normalizeUsername = (value: string) => value.replace('@', '').trim();

    const getProfileHref = (value: string) => `/profile/${encodeURIComponent(normalizeUsername(value))}`;

    const getUserAvatar = (value: string) => userAvatars[normalizeUsername(value)] ?? null;

    const UserAvatar = ({ username, size = 28 }: { username: string; size?: number }) => {
        const avatarUrl = getUserAvatar(username);
        const initials = normalizeUsername(username).slice(0, 2).toUpperCase() || 'U';

        return (
            <div
                className="relative flex-shrink-0 overflow-hidden rounded-full bg-zinc-500 text-white flex items-center justify-center font-bold uppercase"
                style={{ width: size, height: size }}
            >
                {avatarUrl ? (
                    <Image
                        src={avatarUrl}
                        alt={`Avatar of ${normalizeUsername(username)}`}
                        fill
                        unoptimized
                        sizes={`${size}px`}
                        className="object-cover"
                    />
                ) : (
                    <span className="text-[10px] leading-none">{initials}</span>
                )}
            </div>
        );
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

    useEffect(() => {
        if (!issue) return;

        const apiKey = getStoredApiKey();
        if (!apiKey) return;

        const usernames = new Set<string>();

        issue.comments.forEach((comment) => {
            const author = normalizeUsername(comment.author);
            if (author) usernames.add(author);
        });

        issue.activities.forEach((activity) => {
            const actor = normalizeUsername(getActivityUser(activity));
            if (actor && actor.toLowerCase() !== 'system') usernames.add(actor);
        });

        const missingUsernames = Array.from(usernames).filter((username) => userAvatars[username] === undefined);
        if (missingUsernames.length === 0) return;

        let cancelled = false;

        const loadAvatars = async () => {
            const results = await Promise.all(
                missingUsernames.map(async (username) => {
                    try {
                        const profile = await fetchProfile(username, apiKey);
                        return [username, profile.avatar ?? null] as const;
                    } catch {
                        return [username, null] as const;
                    }
                })
            );

            if (cancelled) return;

            setUserAvatars((prev) => {
                const next = { ...prev };
                results.forEach(([username, avatarUrl]) => {
                    next[username] = avatarUrl;
                });
                return next;
            });
        };

        void loadAvatars();

        return () => {
            cancelled = true;
        };
    }, [issue, userAvatars]);

    if (loading) return <div className="p-10 text-center text-zinc-400 font-medium">Loading issue data...</div>;
    if (!issue) return (
        <div className="flex flex-col gap-5 p-10 text-center text-red-500 font-medium">
            Issue not found.
            <Link href="/issues" className="text-[#4db6ac] hover:underline text-sm font-semibold">← Back to issues</Link>
        </div>
    );

    const creatorName = issue.creator || 'unknown';
    const assigneeName = issue.assignee || 'Unassigned';
    const currentWatchers = issue.watchers || [];

    const cleanCreator = creatorName.replace('@', '').trim().toLowerCase();
    const cleanCurrentUser = (currentUser ?? '').replace('@', '').trim().toLowerCase();
    const isMyIssue = currentUser && cleanCreator === cleanCurrentUser;

    const currentAssigneeValue = (() => {
        if (!issue.assignee || issue.assignee.toLowerCase() === 'unassigned') return '';
        const username = issue.assignee.replace('@', '').trim();
        const fallbackId = getUserIdByUsername(username);
        return fallbackId == null ? '' : String(fallbackId);
    })();

    const canAssignToMe = !!currentUser && assigneeName.replace('@', '').trim().toLowerCase() !== cleanCurrentUser;

    const sideAttrs = [
        { label: 'Type',     key: 'type',     fieldKey: 'issue_type', currentName: issue.type,     options: types },
        { label: 'Severity', key: 'severity', fieldKey: 'issue_severity', currentName: issue.severity, options: severities },
        { label: 'Priority', key: 'priority', fieldKey: 'priority',   currentName: issue.priority, options: priorities },
    ];

    const statusColor = findColor(statuses, issue.status);
    const availableTags = allTags.filter(t => !enrichedTags.some(it => it.id === t.id));

    const InlineOptionsList = ({
        options,
        currentName,
        fieldKey,
        onClose,
    }: {
        options: AnyEntity[];
        currentName: string;
        fieldKey: string;
        onClose: () => void;
    }) => (
        <div className="mt-1 bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
            {options.map(opt => {
                const isSelected = opt.name.toLowerCase() === (currentName || '').toLowerCase();
                return (
                    <div
                        key={opt.id}
                        onClick={() => handleSelectOption(fieldKey, opt.id)}
                        className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm transition-colors ${
                            isSelected
                                ? 'bg-[#e8f7f6] text-[#2c3e50] font-semibold'
                                : 'hover:bg-zinc-50 text-zinc-700'
                        }`}
                    >
                        <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: opt.color || '#cbd5e1' }}
                        />
                        <span className="flex-1">{opt.name}</span>
                        {isSelected && <span className="text-[#4db6ac] text-xs">✓</span>}
                    </div>
                );
            })}
            <div className="border-t border-zinc-100">
                <div
                    onClick={onClose}
                    className="px-3 py-2 text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 text-center"
                >
                    Cancel
                </div>
            </div>
        </div>
    );

    return (
        <div
            className="min-h-screen bg-[#f4f7f9] text-[#333] font-sans py-10 px-6"
            onClick={() => openPicker && setOpenPicker(null)}
        >
            <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-8" onClick={e => e.stopPropagation()}>

                {/* LEFT SECTION */}
                <div className="flex-1 min-w-0">

                    {/* HEADER */}
                    <div className="mb-6">
                        <Link href="/issues" className="text-[#4db6ac] hover:underline text-sm font-semibold">
                            ← Back to issues
                        </Link>
                        <div className="flex items-start gap-3 mt-3">
                            <span className="text-2xl font-bold text-zinc-400 mt-1">#{issue.id}</span>
                            {isEditingSubject ? (
                                <div className="flex flex-col flex-1 gap-1">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={subjectInput}
                                            onChange={e => { setSubjectInput(e.target.value); setSubjectError(''); }}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleSaveSubject();
                                                if (e.key === 'Escape') {
                                                    setIsEditingSubject(false);
                                                    setSubjectError('');
                                                    setSubjectInput(issue.subject);
                                                }
                                            }}
                                            autoFocus
                                            className="flex-1 px-3 py-1.5 text-2xl font-bold border border-zinc-300 rounded outline-none focus:border-[#4db6ac]"
                                        />
                                        <button onClick={handleSaveSubject} className="bg-[#4db6ac] text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-[#3ca398]">Save</button>
                                        <button
                                            onClick={() => { setIsEditingSubject(false); setSubjectError(''); setSubjectInput(issue.subject); }}
                                            className="bg-zinc-200 text-zinc-600 px-4 py-1.5 rounded text-sm font-medium hover:bg-zinc-300"
                                        >Cancel</button>
                                    </div>
                                    {subjectError && <span className="text-red-500 text-xs">{subjectError}</span>}
                                </div>
                            ) : (
                                <h1 className="text-3xl font-bold text-[#2c3e50] flex items-center gap-3 flex-1">
                                    {issue.subject}
                                    {isCreator && (
                                        <span
                                            onClick={() => { setSubjectInput(issue.subject); setIsEditingSubject(true); }}
                                            className="cursor-pointer text-base text-zinc-400 hover:text-zinc-600 flex-shrink-0"
                                            title="Edit subject"
                                        >✎</span>
                                    )}
                                </h1>
                            )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-1">
                            Created {new Date(issue.created_at).toLocaleDateString('en-GB')} | Updated {new Date(issue.modified_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>

                    {/* DESCRIPTION CARD */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200/60 mb-6">
                        {/* STATUS BADGE — clickable for creator, expands inline picker */}
                        <div className="mb-4" onClick={e => e.stopPropagation()}>
                            <button
                                onClick={() => isCreator && setOpenPicker(openPicker === 'status' ? null : 'status')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1 text-white text-xs font-bold rounded-full uppercase transition-opacity ${isCreator ? 'cursor-pointer hover:opacity-85' : 'cursor-default'}`}
                                style={{ backgroundColor: statusColor }}
                            >
                                {issue.status || 'In Progress'}
                                {isCreator && <span className="opacity-75 text-[10px]">▾</span>}
                            </button>

                            {openPicker === 'status' && (
                                <div className="mt-2 max-w-xs">
                                    <InlineOptionsList
                                        options={statuses}
                                        currentName={issue.status}
                                        fieldKey="status"
                                        onClose={() => setOpenPicker(null)}
                                    />
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between border-b border-zinc-100 pb-2 mb-3">
                            <h3 className="text-base font-bold text-[#2c3e50]">Description</h3>
                            {isCreator && !isEditingDescription && (
                                <button
                                    onClick={() => { setDescriptionInput(issue.description || ''); setIsEditingDescription(true); }}
                                    className="cursor-pointer text-zinc-400 hover:text-zinc-600 text-sm"
                                    title="Edit description"
                                >✎</button>
                            )}
                        </div>

                        {isEditingDescription ? (
                            <div>
                                <textarea
                                    value={descriptionInput}
                                    onChange={e => setDescriptionInput(e.target.value)}
                                    rows={5}
                                    autoFocus
                                    className="w-full p-3 border border-zinc-300 rounded resize-none outline-none focus:border-[#4db6ac] text-sm"
                                />
                                <div className="flex gap-2 mt-2 justify-end">
                                    <button onClick={() => setIsEditingDescription(false)} className="bg-zinc-200 text-zinc-600 px-3 py-1.5 rounded text-xs font-medium hover:bg-zinc-300">Cancel</button>
                                    <button onClick={handleSaveDescription} className="bg-[#4db6ac] text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-[#3ca398]">Save</button>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-zinc-600 leading-relaxed whitespace-pre-wrap min-h-8">
                                {issue.description || <span className="italic text-zinc-400">No description provided</span>}
                            </p>
                        )}

                        {/* ATTACHMENTS */}
                        <div className="mt-6">
                            <div className="mb-4 flex justify-left items-center gap-3">
                                <h3 className="text-lg font-bold text-[#2c3e50]">
                                    {issue.attachments?.length || 0} {(issue.attachments?.length === 1) ? 'Attachment' : 'Attachments'}
                                </h3>
                                <button onClick={() => fileRef.current?.click()} className="flex align-center justify-center items-center w-7 h-7 font-bold bg-[#5dc5b5] text-white cursor-pointer rounded-sm">+</button>
                                <input ref={fileRef} type="file" onChange={handleAddAttachment} hidden></input>
                                <h2 className="text-sm text-[#2c3e50]">{uploading ? 'Uploading...' : ''}</h2>
                            </div>
                            {issue.attachments?.length === 0 ?
                                ''
                                : <div className="flex flex-col gap-2 p-2.5 bg-zinc-50 rounded border border-zinc-200/80 text-sm">
                                    {issue.attachments?.map(att => (
                                        <div key={att.id} className="flex flex-row justify-between items-center">
                                            <a href={att.url} target="_blank" rel="noreferrer"
                                               className="text-[#4db6ac] hover:underline font-medium cursor-pointer">{att.name}</a>
                                            {att.creator_id === getUserIdByUsername(currentUser ?? '') ?
                                                <button onClick={() => handleDeleteAttachmentClick(att.id)}
                                                        className="cursor-pointer border-2 border-red-500 text-red-500 font-bold p-1 transition duration-200 hover:bg-red-500 hover:text-white">X
                                                </button>
                                            : ''}
                                        </div>
                                    ))}
                                </div>
                            }
                        </div>
                    </div>

                    {/* COMMENTS / ACTIVITIES */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-zinc-200/60">
                        <div className="flex gap-6 border-b border-zinc-200 mb-6">
                            <button
                                onClick={() => setActiveTab('comments')}
                                className={`pb-2.5 cursor-pointer font-bold text-sm transition-colors ${activeTab === 'comments' ? 'text-[#4db6ac] border-b-2 border-[#4db6ac]' : 'text-zinc-400 hover:text-zinc-600'}`}
                            >
                                {issue.comments?.length || 0} {issue.comments?.length === 1 ? 'Comment' : 'Comments'}
                            </button>
                            <button
                                onClick={() => setActiveTab('activities')}
                                className={`pb-2.5 cursor-pointer font-bold text-sm transition-colors ${activeTab === 'activities' ? 'text-[#4db6ac] border-b-2 border-[#4db6ac]' : 'text-zinc-400 hover:text-zinc-600'}`}
                            >
                                {issue.activities?.length || 0} {issue.activities?.length === 1 ? 'Activity' : 'Activities'}
                            </button>
                        </div>

                        {activeTab === 'activities' ? (
                            <div className="flex flex-col gap-4">
                                {issue.activities?.map(act => (
                                    <div key={act.id} className="flex gap-3 text-sm">
                                        <UserAvatar username={getActivityUser(act)} />
                                        <div>
                                            <div className="text-zinc-800">
                                                {act.user ? (
                                                    <Link
                                                        href={getProfileHref(act.user)}
                                                        className="font-bold text-[#4db6ac] hover:underline"
                                                    >
                                                        {act.user}
                                                    </Link>
                                                ) : (
                                                    <strong>System</strong>
                                                )}{' '}
                                                {getActivityLabel(act.field, act.old, act.new)}
                                            </div>
                                            <div className="text-xs text-zinc-400 mt-0.5">
                                                {act.old || '-'} → {act.new || '-'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {(!issue.activities || issue.activities.length === 0) && (
                                    <p className="text-center text-sm text-zinc-400 py-4">No activities registered.</p>
                                )}
                            </div>
                        ) : (
                            <div>
                                <form onSubmit={handlePublishComment} className="mb-6">
                                    <textarea
                                        placeholder="Write something..."
                                        value={newCommentBody}
                                        onChange={e => setNewCommentBody(e.target.value)}
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

                                <div className="flex flex-col gap-4">
                                    {issue.comments?.map(com => {
                                        const cleanAuthor = com.author?.replace('@', '').trim().toLowerCase() || '';
                                        const cleanCommentUser = (currentUser ?? '').replace('@', '').trim().toLowerCase();
                                        const isMyComment = cleanAuthor === cleanCommentUser;
                                        return (
                                            <div key={com.id} className="p-4 border border-zinc-100 rounded-md bg-zinc-50/30">
                                                <div className="flex items-start gap-3">
                                                    <UserAvatar username={com.author} size={30} />
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 text-xs mb-2">
                                                            <Link href={getProfileHref(com.author)} className="text-[#4db6ac] font-bold hover:underline">
                                                                @{com.author?.replace('@', '')}
                                                            </Link>
                                                            <span className="text-zinc-400">{getRelativeTimeString(com.created_at)}</span>
                                                        </div>
                                                        {editingCommentId === com.id ? (
                                                            <div>
                                                                <textarea
                                                                    value={editingCommentBody}
                                                                    onChange={e => setEditingCommentBody(e.target.value)}
                                                                    className="w-full p-2 border border-zinc-300 rounded text-sm outline-none focus:border-zinc-400"
                                                                    rows={2}
                                                                />
                                                                <div className="mt-2 flex gap-3 justify-end items-center">
                                                                    <button onClick={() => { setEditingCommentId(null); }} className="cursor-pointer text-zinc-400 hover:text-zinc-600 text-xs font-medium">Cancelar</button>
                                                                    <button onClick={() => handleSaveCommentEdit(com.id)} className="cursor-pointer bg-[#4db6ac] text-white px-3 py-1 rounded text-xs font-bold hover:bg-[#3ca398]">GUARDAR</button>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <React.Fragment>
                                                                <p className="text-sm text-zinc-700 whitespace-pre-wrap">{com.body}</p>
                                                                {isMyComment && (
                                                                    <div className="mt-3 flex gap-4 text-xs font-bold border-t border-zinc-100 pt-2">
                                                                        <button onClick={() => { setEditingCommentId(com.id); setEditingCommentBody(com.body); }} className="text-[#4db6ac] cursor-pointer hover:underline">Editar</button>
                                                                        <button onClick={() => handleDeleteCommentClick(com.id)} className="text-red-500 cursor-pointer hover:underline">Eliminar</button>
                                                                    </div>
                                                                )}
                                                            </React.Fragment>
                                                        )}
                                                    </div>
                                                </div>
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

                {/* RIGHT SIDEBAR */}
                <div className="w-full lg:w-80 flex-shrink-0 bg-white p-5 rounded-lg shadow-sm border border-zinc-200/60 h-fit" onClick={e => e.stopPropagation()}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-4">DETAILS</h4>

                    {/* Type / Severity / Priority — inline expanding pickers */}
                    {sideAttrs.map(attr => {
                        const isOpen = openPicker === attr.key;
                        const currentColor = findColor(attr.options, attr.currentName);

                        return (
                            <div key={attr.label} className="border-b border-zinc-100">
                                <div className="flex justify-between items-center py-3 text-sm">
                                    <span className="text-zinc-400">{attr.label}</span>
                                    <button
                                        onClick={() => isCreator && setOpenPicker(isOpen ? null : attr.key)}
                                        className={`font-semibold text-zinc-700 flex items-center gap-2 ${isCreator ? 'cursor-pointer hover:text-[#4db6ac] group' : 'cursor-default'}`}
                                    >
                        <span
                            className="w-2 h-2 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: currentColor }}
                        />
                                        {attr.currentName || 'None'}
                                        {isCreator && (
                                            <span className="text-zinc-300 group-hover:text-zinc-500 text-xs transition-colors">✎</span>
                                        )}
                                    </button>
                                </div>

                                {isOpen && (
                                    <div className="pb-2">
                                        <InlineOptionsList
                                            options={attr.options}
                                            currentName={attr.currentName}
                                            fieldKey={attr.fieldKey}
                                            onClose={() => setOpenPicker(null)}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {/* DEADLINE */}
                    <div className="py-3 border-b border-zinc-100 text-sm">
                        {isEditingDeadline ? (
                            <div className="flex flex-col gap-2">
                                <span className="text-zinc-400">Deadline</span>
                                <input
                                    type="date"
                                    value={deadlineInput}
                                    onChange={e => setDeadlineInput(e.target.value)}
                                    autoFocus
                                    className="w-full bg-white border border-zinc-300 rounded px-2 py-1.5 text-sm outline-none focus:border-[#4db6ac] cursor-pointer"
                                />
                                <div className="flex gap-1.5 justify-end">
                                    <button type="button" onClick={() => handleSaveDeadline(null)} className="text-zinc-400 hover:text-red-400 px-2 py-1 rounded text-xs font-medium cursor-pointer">Clear date</button>
                                    <button type="button" onClick={() => setIsEditingDeadline(false)} className="bg-zinc-200 text-zinc-600 px-2 py-1 rounded text-xs hover:bg-zinc-300 cursor-pointer">Cancel</button>
                                    <button type="button" onClick={() => handleSaveDeadline(deadlineInput || null)} className="bg-[#4db6ac] text-white px-2 py-1 rounded text-xs font-bold hover:bg-[#3ca398] cursor-pointer">Save</button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex justify-between items-center">
                                <span className="text-zinc-400">Deadline</span>
                                <button
                                    onClick={() => {
                                        if (!isCreator) return;
                                        setDeadlineInput(issue.deadline ? new Date(issue.deadline).toISOString().split('T')[0] : '');
                                        setIsEditingDeadline(true);
                                    }}
                                    className={`font-semibold text-zinc-700 flex items-center gap-1.5 ${isCreator ? 'cursor-pointer hover:text-[#4db6ac] group' : 'cursor-default'}`}
                                >
                                    {issue.deadline ? new Date(issue.deadline).toLocaleDateString('en-GB') : 'No date'}
                                    {isCreator && <span className="text-zinc-300 group-hover:text-zinc-500 text-xs transition-colors">✎</span>}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* CREATOR */}
                    <div className="flex justify-between items-center py-3 border-b border-zinc-100 text-sm">
                        <span className="text-zinc-400">Creator</span>
                        <Link
                            href={getProfileHref(creatorName)}
                            className="font-bold text-zinc-700 hover:text-[#4db6ac] hover:underline cursor-pointer"
                        >
                            @{creatorName.replace('@', '')}
                        </Link>
                    </div>

                    {/* ASSIGNEE */}
                    <div className="flex justify-between items-center py-3 border-b border-zinc-100 text-sm">
                        <span className="text-zinc-400">Assigned</span>
                        <div className="flex flex-col items-end gap-2">
                            <AssigneeDropdown
                                value={currentAssigneeValue}
                                onChange={handleAssigneeSelectChange}
                                disabled={isSavingAssignee}
                                className="text-xs px-2 py-1.5 border border-zinc-200 rounded outline-none bg-zinc-50/50 text-zinc-700 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <option value="">Unassigned</option>
                                {AUTH_USERS.map((user) => (
                                    <option key={user.id} value={String(user.id)}>{user.username}</option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={handleAssignToMe}
                                disabled={!canAssignToMe || isSavingAssignee}
                                className="bg-zinc-100 text-zinc-700 border border-zinc-300 hover:bg-zinc-200 text-xs font-bold px-2.5 py-1.5 rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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

                    {/* TAGS */}
                    <div className="py-3 border-b border-zinc-100 text-sm">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-zinc-400">Tags</span>
                            {isCreator && (
                                <button
                                    type="button"
                                    onClick={() => setOpenPicker(openPicker === 'tags' ? null : 'tags')}
                                    className="text-xs text-[#4db6ac] hover:underline font-medium cursor-pointer"
                                >
                                    + Add tag
                                </button>
                            )}
                        </div>

                        {openPicker === 'tags' && (
                            <div className="mb-2 bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
                                {availableTags.length === 0 ? (
                                    <div className="px-3 py-2 text-xs text-zinc-400 text-center">All tags applied</div>
                                ) : (
                                    availableTags.map(tag => (
                                        <div
                                            key={tag.id}
                                            onClick={() => handleAddTag(tag.id)}
                                            className="flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm hover:bg-zinc-50 text-zinc-700"
                                        >
                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color || '#cbd5e1' }} />
                                            <span>{tag.name}</span>
                                        </div>
                                    ))
                                )}
                                <div className="border-t border-zinc-100">
                                    <div
                                        onClick={() => setOpenPicker(null)}
                                        className="px-3 py-2 text-xs text-zinc-400 cursor-pointer hover:text-zinc-600 text-center"
                                    >
                                        Cancel
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-wrap gap-1.5">
                            {enrichedTags.map(tag => (
                                <span
                                    key={tag.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                    style={{ backgroundColor: tag.color || '#888' }}
                                >
                    {tag.name}
                                    {isCreator && (
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTag(tag.id)}
                                            className="ml-0.5 hover:opacity-70 leading-none text-sm cursor-pointer"
                                            title="Remove tag"
                                        >×</button>
                                    )}
                </span>
                            ))}
                            {enrichedTags.length === 0 && (
                                <span className="text-zinc-400 text-xs italic">No tags</span>
                            )}
                        </div>
                    </div>

                    {/* WATCHERS */}
                    <div className="mt-4 border-b border-zinc-100 pb-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
                            WATCHERS ({issue.watchers?.length || 0})
                        </h4>

                        {/* Lista de watchers actuales */}
                        <ul className="mb-4 flex flex-col gap-2">
                            {issue.watchers?.map((watcher: string) => {
                                return (
                                    <li key={`${watcher}`} className="flex justify-between items-center text-sm bg-zinc-50 p-2 rounded border border-zinc-100">
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-700 font-medium text-xs">@{watcher || 'unknown'}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteWatcher(getUserIdByUsername(watcher) ?? 0)}
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
                                className="flex-1 bg-white border border-zinc-200 rounded text-xs p-2 outline-none focus:border-zinc-400 text-zinc-600 cursor-pointer"
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
                                className="bg-zinc-100 text-zinc-700 border border-zinc-200 px-3 py-1.5 rounded text-sm font-bold hover:bg-zinc-200 active:bg-zinc-300 transition-colors cursor-pointer"
                            >
                                +
                            </button>
                        </form>
                    </div>

                    {isMyIssue && (
                        <div className="mt-8">
                            <button
                                type="button"
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
