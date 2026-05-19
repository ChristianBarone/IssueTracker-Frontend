'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { fetchProfile, ProfileData, ProfileIssue } from '../profileService';
import { clearStoredUser, getStoredApiKey } from '../../lib/auth';

function formatDate(value: string | null | undefined) {
    if (!value) return 'No date available';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function formatDateTime(value: string) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getInitials(username: string) {
    return username.slice(0, 2).toUpperCase();
}

function normalizeLabel(value: string | null | undefined) {
    return (value || '').trim().toLowerCase();
}

function getDotColor(kind: 'type' | 'severity' | 'priority', value: string | null | undefined) {
    const label = normalizeLabel(value);

    if (kind === 'type') {
        if (label === 'bug') return '#ef4444';
        if (label === 'question') return '#f59e0b';
        if (label === 'enhancement') return '#22c55e';
    }

    if (kind === 'severity') {
        if (label === 'minor') return '#22d3ee';
        if (label === 'normal') return '#eab308';
        if (label === 'important') return '#fb923c';
        if (label === 'critical') return '#f43f5e';
        if (label === 'wishlist') return '#64748b';
    }

    if (kind === 'priority') {
        if (label === 'low') return '#fb923c';
        if (label === 'normal') return '#7c83ff';
        if (label === 'high') return '#a3e635';
    }

    return '#cbd5e1';
}

function truncate(text: string, maxLength: number) {
    if (text.length <= maxLength) return text;
    return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

function IssueRow({ issue }: { issue: ProfileIssue }) {
    return (
        <div className="grid gap-3 rounded-[14px] border border-slate-200 bg-white px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.02)] md:grid-cols-[1fr_170px_110px] md:items-center md:px-5">
            <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex flex-shrink-0 gap-2">
                    <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: getDotColor('type', issue.type) }} />
                    <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: getDotColor('severity', issue.severity) }} />
                    <span className="inline-block h-3.5 w-3.5 rounded-full" style={{ backgroundColor: getDotColor('priority', issue.priority) }} />
                </span>

                <Link href={`/issues/${issue.id}`} className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 font-bold text-[#2f93b8]">#{issue.id}</span>
                    <span className="truncate font-semibold text-slate-800 transition-colors hover:text-[#1784a8]">
                        {issue.subject}
                    </span>
                </Link>
            </div>

            <div className="text-sm text-slate-500 md:text-right">{issue.status || 'Unknown'}</div>
            <div className="text-sm text-slate-500 md:text-right">{formatDate(issue.modified_at)}</div>
        </div>
    );
}

function CommentRow({ comment }: { comment: { id: number; author: string; body: string; created_at: string } }) {
    return (
        <div className="rounded-[14px] border border-slate-200 bg-white px-4 py-4 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
            <div className="text-sm font-bold text-[#1784a8]">@{comment.author}</div>
            <p className="mt-2 text-sm leading-6 text-slate-700">{truncate(comment.body, 160)}</p>
            <small className="mt-2 block text-xs text-slate-500">{formatDateTime(comment.created_at)}</small>
        </div>
    );
}

type ProfileComment = {
    id: number;
    author: string;
    body: string;
    created_at: string;
};

export default function ProfilePage() {
    const params = useParams<{ username: string }>();
    const searchParams = useSearchParams();
    const router = useRouter();
    const username = decodeURIComponent(params.username);

    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const activeTab = searchParams.get('tab') ?? 'assigned';
    const isOwner = Boolean(profile?.auth_key);
    const tab = activeTab === 'watched' && !isOwner ? 'assigned' : activeTab;

    useEffect(() => {
        document.title = `Profile - ${username}`;
    }, [username]);

    useEffect(() => {
        let mounted = true;

        const loadProfile = async () => {
            setLoading(true);
            setError(null);
            setProfile(null);

            try {
                const apiKey = getStoredApiKey();
                if (!apiKey) {
                    throw new Error('Session expired. Please sign in again.');
                }

                const data = await fetchProfile(username, apiKey);
                if (mounted) {
                    setProfile(data);
                }
            } catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Failed to load profile.');
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        loadProfile();

        return () => {
            mounted = false;
        };
    }, [username]);

    const issueItems = useMemo<ProfileIssue[]>(() => {
        if (!profile || tab === 'comments') return [];
        if (tab === 'watched') return profile.watched_issues ?? [];
        return profile.open_assigned_issues;
    }, [profile, tab]);

    const commentItems = useMemo<ProfileComment[]>(() => {
        if (!profile || tab !== 'comments') return [];
        return profile.comments;
    }, [profile, tab]);

    const watchedCount = profile?.watched_issues?.length ?? 0;

    const handleSwitchUser = () => {
        clearStoredUser();
        router.replace('/');
    };

    const handleRetry = () => {
        router.refresh();
    };

    return (
        <main
            className="min-h-screen px-4 py-6 text-slate-700 md:px-6"
            style={{
                fontFamily: '"Ubuntu", "Segoe UI", sans-serif',
                backgroundImage:
                    'radial-gradient(circle at top left, rgba(47, 147, 184, 0.12), transparent 30%), radial-gradient(circle at top right, rgba(93, 197, 181, 0.12), transparent 26%)',
                backgroundColor: '#f5f7fb'
            }}
        >
            <div className="mx-auto grid w-full max-w-[1280px] gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
                <aside className="sticky top-6 h-fit overflow-hidden rounded-[18px] border border-slate-200/90 bg-white p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    {loading ? (
                        <div className="space-y-4 py-6 text-center text-slate-400">Loading profile…</div>
                    ) : error ? (
                        <div className="rounded-[14px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
                    ) : profile ? (
                        <>
                            <div className="relative mx-auto mb-4 grid h-[230px] w-[230px] place-items-center overflow-hidden rounded-[6px] bg-gradient-to-b from-slate-950 to-slate-900 text-[72px] font-bold tracking-tight text-white">
                                {profile.avatar ? (
                                    <Image
                                        src={profile.avatar}
                                        alt={`Avatar of ${profile.username}`}
                                        fill
                                        unoptimized
                                        sizes="230px"
                                        className="object-cover"
                                    />
                                ) : (
                                    getInitials(profile.username)
                                )}
                            </div>

                            <h1 className="m-0 text-[30px] font-bold leading-none text-[#2f93b8]">
                                {profile.username}
                            </h1>
                            <div className="mb-4 mt-2 text-[17px] text-slate-500">@{profile.username}</div>

                            <div className="mb-4 grid grid-cols-3 gap-2 border-y border-slate-200 py-4">
                                <div className="text-center">
                                    <strong className="block text-[30px] leading-none text-slate-900">
                                        {profile.open_assigned_issues.length}
                                    </strong>
                                    <span className="mt-1 block text-[13px] text-slate-500">Open Assigned Issues</span>
                                </div>
                                <div className="text-center">
                                    <strong className="block text-[30px] leading-none text-slate-900">{watchedCount}</strong>
                                    <span className="mt-1 block text-[13px] text-slate-500">Watched Issues</span>
                                </div>
                                <div className="text-center">
                                    <strong className="block text-[30px] leading-none text-slate-900">{profile.comments.length}</strong>
                                    <span className="mt-1 block text-[13px] text-slate-500">Comments</span>
                                </div>
                            </div>

                            <div className="pb-4 text-[16px] leading-7 text-slate-700">
                                {profile.bio || 'This user has not added a biography yet.'}
                            </div>

                            {isOwner && profile.auth_key && (
                                <div className="mb-4 border-y border-slate-200 py-4 text-sm">
                                    <div className="mb-2 font-medium text-slate-600">API Key: (click to copy)</div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            await navigator.clipboard.writeText(profile.auth_key || '');
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left font-mono text-xs text-slate-700 transition-colors hover:bg-slate-100"
                                    >
                                        {profile.auth_key}
                                    </button>
                                </div>
                            )}

                            <div className="mb-4 text-sm text-slate-500">
                                <strong className="text-slate-700">Registered:</strong> {formatDate(profile.registered)}
                            </div>

                            <div className="flex flex-col gap-2">
                                {isOwner && (
                                    <Link
                                        href={`/profile/${encodeURIComponent(profile.username)}/edit`}
                                        className="inline-flex min-h-12 items-center justify-center rounded-lg bg-gradient-to-b from-[#82e9de] to-[#59d8cc] px-4 font-bold text-slate-900 shadow-[0_6px_0_#40bbb1] transition-transform hover:-translate-y-px"
                                    >
                                        EDIT BIO
                                    </Link>
                                )}
                                <Link
                                    href="/issues"
                                    className="inline-flex min-h-12 items-center justify-center rounded-lg bg-slate-100 px-4 font-bold text-slate-700 shadow-[0_4px_0_#cbd5e1] transition-transform hover:-translate-y-px"
                                >
                                    BACK TO ISSUES
                                </Link>
                                {isOwner && (
                                    <button
                                        type="button"
                                        onClick={handleSwitchUser}
                                        className="inline-flex min-h-12 items-center justify-center rounded-lg bg-[#fef2f2] px-4 font-bold text-[#991b1b] shadow-[0_4px_0_#fecaca] transition-transform hover:-translate-y-px"
                                    >
                                        SWITCH USER
                                    </button>
                                )}
                            </div>
                        </>
                    ) : null}
                </aside>

                <section className="overflow-hidden rounded-[18px] border border-slate-200/90 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
                    <div className="flex gap-0 overflow-x-auto border-b border-slate-200 bg-[#fbfcfe]">
                        <Link
                            href={`/profile/${encodeURIComponent(username)}?tab=assigned`}
                            className={`inline-flex items-center whitespace-nowrap border-r border-slate-200 px-5 py-4 font-bold transition-colors ${tab === 'assigned' ? 'bg-white text-slate-800 shadow-[inset_0_-3px_0_#2f93b8]' : 'text-slate-500'}`}
                        >
                            Open Assigned Issues
                        </Link>
                        {isOwner && (
                            <Link
                                href={`/profile/${encodeURIComponent(username)}?tab=watched`}
                                className={`inline-flex items-center whitespace-nowrap border-r border-slate-200 px-5 py-4 font-bold transition-colors ${tab === 'watched' ? 'bg-white text-slate-800 shadow-[inset_0_-3px_0_#2f93b8]' : 'text-slate-500'}`}
                            >
                                Watched Issues
                            </Link>
                        )}
                        <Link
                            href={`/profile/${encodeURIComponent(username)}?tab=comments`}
                            className={`inline-flex items-center whitespace-nowrap px-5 py-4 font-bold transition-colors ${tab === 'comments' ? 'bg-white text-slate-800 shadow-[inset_0_-3px_0_#2f93b8]' : 'text-slate-500'}`}
                        >
                            Comments
                        </Link>
                    </div>

                    <div className="p-6 md:p-6">
                        {error && (
                            <div className="mb-5 rounded-[14px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                <div className="font-bold">Profile load failed</div>
                                <div className="mt-1">{error}</div>
                                <button
                                    type="button"
                                    onClick={handleRetry}
                                    className="mt-3 inline-flex items-center rounded-lg bg-white px-3 py-2 font-bold text-rose-700 shadow-[0_3px_0_#fecaca]"
                                >
                                    Retry
                                </button>
                            </div>
                        )}

                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="m-0 text-[20px] font-bold text-slate-900">User Profile</h2>
                                <div className="mt-1 text-sm text-slate-500">No email available</div>
                            </div>

                            {isOwner && (
                                <span className="inline-flex items-center gap-2 rounded-full bg-[#e8f6fb] px-3 py-2 text-[13px] font-bold text-[#1784a8]">
                                    Your profile
                                </span>
                            )}
                        </div>

                        {loading ? (
                            <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-5 text-center text-slate-400">
                                Loading profile content…
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {tab === 'comments' ? (
                                    commentItems.length > 0 ? (
                                        <div className="space-y-4">
                                            {commentItems.map((comment) => (
                                                <CommentRow key={comment.id} comment={comment} />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-5 text-center text-slate-500">
                                            This user has not posted any comments yet.
                                        </div>
                                    )
                                ) : issueItems.length > 0 ? (
                                    <div className="space-y-3">
                                        {issueItems.map((issue) => (
                                            <IssueRow key={issue.id} issue={issue} />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-5 text-center text-slate-500">
                                        {tab === 'watched'
                                            ? 'This user is not watching any issues yet.'
                                            : 'No issues to show.'}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </main>
    );
}