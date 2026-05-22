'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { fetchProfile, updateProfile } from '../../profileService';

export default function EditProfilePage() {
    const params = useParams<{ username: string }>();
    const router = useRouter();
    const username = decodeURIComponent(params.username);

    const [bio, setBio] = useState('');
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [displayName, setDisplayName] = useState(username);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        document.title = `Edit profile - ${username}`;
    }, [username]);

    useEffect(() => {
        let mounted = true;

        const loadProfile = async () => {
            setLoading(true);
            setError(null);

            try {
                const profile = await fetchProfile(username);
                if (!mounted) return;

                setBio(profile.bio || '');
                setAvatarPreview(profile.avatar);
                setDisplayName(profile.username);
            } catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Failed to load profile editor.');
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

    useEffect(() => {
        return () => {
            if (avatarPreview && avatarPreview.startsWith('blob:')) {
                URL.revokeObjectURL(avatarPreview);
            }
        };
    }, [avatarPreview]);

    const handleAvatarChange = (file: File | null) => {
        setAvatarFile(file);

        if (avatarPreview && avatarPreview.startsWith('blob:')) {
            URL.revokeObjectURL(avatarPreview);
        }

        setAvatarPreview(file ? URL.createObjectURL(file) : null);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setSaving(true);
        setError(null);

        try {
            await updateProfile(username, { bio, avatar: avatarFile });
            router.push(`/profile/${encodeURIComponent(username)}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save profile.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <main
            className="min-h-screen px-4 py-8 text-slate-700 md:px-6"
            style={{
                fontFamily: '"Ubuntu", "Segoe UI", sans-serif',
                backgroundImage:
                    'radial-gradient(circle at top left, rgba(47, 147, 184, 0.12), transparent 30%), radial-gradient(circle at top right, rgba(93, 197, 181, 0.12), transparent 26%)',
                backgroundColor: '#f5f7fb'
            }}
        >
            <div className="mx-auto w-full max-w-215">
                <div className="rounded-[18px] border border-slate-200/90 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)] md:p-6">
                    <div className="mb-6 flex items-start justify-between gap-4">
                        <div>
                            <h1 className="m-0 text-[28px] font-bold text-slate-900">Edit profile</h1>
                            <p className="mt-1 text-slate-500">@{username}</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="rounded-[14px] border border-slate-200 bg-slate-50 p-6 text-center text-slate-400">
                            Loading editor…
                        </div>
                    ) : (
                        <>
                            <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center">
                                <div className="relative grid h-27.5 w-27.5 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-linear-to-b from-slate-950 to-slate-900 text-[42px] font-bold text-white">
                                    {avatarPreview ? (
                                        <Image
                                            src={avatarPreview}
                                            alt={`Avatar of ${username}`}
                                            fill
                                            unoptimized
                                            sizes="110px"
                                            className="object-cover"
                                        />
                                    ) : (
                                        username.slice(0, 2).toUpperCase()
                                    )}
                                </div>
                                <div>
                                    <h2 className="m-0 text-[22px] font-bold text-slate-900">{displayName}</h2>
                                    <p className="mt-1 text-slate-500">Update your avatar and bio.</p>
                                </div>
                            </div>

                            {error && (
                                <div className="mb-5 rounded-[14px] border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSubmit} className="grid gap-5">
                                <div>
                                    <label htmlFor="avatar" className="mb-2 block font-bold text-slate-700">
                                        Avatar
                                    </label>
                                    <input
                                        id="avatar"
                                        type="file"
                                        accept="image/*"
                                        onChange={(event) => handleAvatarChange(event.target.files?.[0] || null)}
                                        className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#2f93b8] focus:ring-2 focus:ring-[#2f93b8]/10 cursor-pointer"
                                    />
                                    <div className="mt-2 text-sm text-slate-500">Upload a square image for best results.</div>
                                </div>

                                <div>
                                    <label htmlFor="bio" className="mb-2 block font-bold text-slate-700">
                                        Bio
                                    </label>
                                    <textarea
                                        id="bio"
                                        rows={7}
                                        value={bio}
                                        onChange={(event) => setBio(event.target.value)}
                                        className="block w-full rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[#2f93b8] focus:ring-2 focus:ring-[#2f93b8]/10"
                                    />
                                </div>

                                <div className="flex justify-end gap-3">
                                    <Link
                                        href={`/profile/${encodeURIComponent(username)}`}
                                        className="inline-flex items-center justify-center rounded-[10px] bg-slate-100 px-4 py-3 font-bold text-slate-700 cursor-pointer"
                                    >
                                        Cancel
                                    </Link>
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="inline-flex items-center justify-center rounded-[10px] bg-gradient-to-b from-[#82e9de] to-[#59d8cc] px-5 py-3 font-bold text-slate-900 shadow-[0_6px_0_#40bbb1] cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {saving ? 'Saving…' : 'Save changes'}
                                    </button>
                                </div>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </main>
    );
}