import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import { getApiBaseUrl } from "../lib/apiBaseUrl";

export interface ProfileIssue {
    id: number;
    subject: string;
    description: string | null;
    status: string | null;
    priority: string | null;
    severity: string | null;
    type: string | null;
    creator: string;
    assignee: string;
    created_at: string;
    modified_at: string;
    deadline: string | null;
    comments: Array<{
        id: number;
        author: string;
        body: string;
        created_at: string;
    }>;
    attachments: Array<{
        id: number;
        name: string;
        url: string;
    }>;
    tags: string[];
    watchers: string[];
    activities: Array<{
        user: string;
        field: string;
        old: string;
        new: string;
        date: string;
    }>;
}

export interface ProfileData {
    username: string;
    bio: string | null;
    registered: string;
    avatar: string | null;
    open_assigned_issues: ProfileIssue[];
    comments: Array<{
        id: number;
        issue_id?: number;
        author: string;
        body: string;
        created_at: string;
    }>;
    watched_issues?: ProfileIssue[];
    auth_key?: string;
}

export async function fetchProfile(username: string, apiKey: string): Promise<ProfileData> {
    // Try once, and retry once on abort/timeout errors
    try {
        const response = await fetchWithTimeout(`${getApiBaseUrl()}/profile/${encodeURIComponent(username)}`, {
            method: 'GET',
            headers: {
                Authorization: apiKey,
                'Content-Type': 'application/json'
            }
        });

        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload?.message || `Failed to load profile (${response.status})`);
        }

        return payload as ProfileData;
    } catch (err: any) {
        const msg = err?.message ?? String(err);
        if (msg.includes('aborted') || msg.includes('timed out')) {
            // transient abort — retry once
            await new Promise((r) => setTimeout(r, 500));
            const response = await fetchWithTimeout(`${getApiBaseUrl()}/profile/${encodeURIComponent(username)}`, {
                method: 'GET',
                headers: {
                    Authorization: apiKey,
                    'Content-Type': 'application/json'
                }
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload?.message || `Failed to load profile (${response.status})`);
            }

            return payload as ProfileData;
        }

        throw err;
    }
}

export async function updateProfile(
    username: string,
    apiKey: string,
    data: { bio: string; avatar?: File | null }
): Promise<ProfileData> {
    const formData = new FormData();
    formData.append('bio', data.bio);

    if (data.avatar) {
        formData.append('avatar', data.avatar);
    }

    try {
        const response = await fetchWithTimeout(`${getApiBaseUrl()}/profile/${encodeURIComponent(username)}`, {
            method: 'PUT',
            headers: {
                Authorization: apiKey
            },
            body: formData
        });

        const payload = await response.json();

        if (!response.ok) {
            throw new Error(payload?.message || `Failed to update profile (${response.status})`);
        }

        return payload as ProfileData;
    } catch (err: any) {
        const msg = err?.message ?? String(err);
        if (msg.includes('aborted') || msg.includes('timed out')) {
            await new Promise((r) => setTimeout(r, 500));
            const response = await fetchWithTimeout(`${getApiBaseUrl()}/profile/${encodeURIComponent(username)}`, {
                method: 'PUT',
                headers: {
                    Authorization: apiKey
                },
                body: formData
            });

            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload?.message || `Failed to update profile (${response.status})`);
            }

            return payload as ProfileData;
        }

        throw err;
    }
}