import { IssueDetailData, UserProfile } from './types';
import { fetchWithTimeout } from '../../lib/fetchWithTimeout';
import { getStoredApiKey } from '../../lib/auth';
import { getApiBaseUrl } from '../../lib/apiBaseUrl';
import { IssueDetailData, IssueField } from './types';
import { getUserById, getUserByUsername } from '../../lib/auth';

const baseUrl = getApiBaseUrl();

const getHeaders = () => ({
    'Authorization': getStoredApiKey() ?? '',
    'Content-Type': 'application/json',
});

// Obtener los detalles de una issue por ID
export async function fetchIssueDetail(id: number): Promise<IssueDetailData | null> {
    try {
        const baseUrl = getApiBaseUrl();
        const res = await fetchWithTimeout(`${baseUrl}/issues/${id}/`, {
            method: 'GET',
            headers: getHeaders(),
            cache: 'no-store' // Para que siempre traiga comentarios frescos
        });
        if (!res.ok) return null;
        const raw = (await res.json()) as Record<string, any>;
        // Debug: log raw backend response for assignee to help diagnose UI mismatch
        try { console.debug('[fetchIssueDetail] raw assignee:', raw.assignee || raw.assigned_to); } catch {};

        // Normalize common backend variations so the UI has consistent shapes
        const normalizeUser = (u: unknown) => {
            if (!u) return null;
            if (typeof u === 'number') {
                const knownUser = getUserById(u);
                return knownUser ? { id: knownUser.id, username: knownUser.username } : null;
            }
            if (typeof u === 'string') {
                const username = u.replace('@', '');
                const knownUser = getUserByUsername(username);
                return knownUser ? { id: knownUser.id, username: knownUser.username } : { id: 0, username };
            }
            if (typeof u === 'object' && u !== null && 'username' in u) {
                const username = String((u as { username: unknown }).username).replace('@', '');
                const rawId = 'id' in u ? Number((u as { id?: unknown }).id) : 0;
                const knownUser = getUserByUsername(username);
                return {
                    id: Number.isFinite(rawId) && rawId > 0 ? rawId : (knownUser?.id ?? 0),
                    username: knownUser?.username ?? username,
                };
            }
            return null;
        };

        const normalizeField = (f: unknown): IssueField | null => {
            if (!f) return null;
            if (typeof f === 'string') return { id: 0, name: f };
            if (typeof f === 'object' && f !== null) {
                const field = f as Partial<IssueField> & { name?: unknown; color?: unknown };
                if (typeof field.name === 'string') {
                    return {
                        id: typeof field.id === 'number' ? field.id : 0,
                        name: field.name,
                        color: typeof field.color === 'string' ? field.color : undefined,
                    };
                }
            }
            return null;
        };

        const normalized: IssueDetailData = {
            id: Number(raw.id),
            subject: raw.subject || '',
            description: raw.description ?? null,
            issue_type: normalizeField(raw.issue_type || raw.type) ?? <IssueField>{id: 1, name: "Default" },
            severity: normalizeField(raw.severity) ?? <IssueField>{id: 1, name: "Default" },
            priority: (normalizeField(raw.priority || raw.issue_priority) || (raw.priority ? { id: 0, name: String(raw.priority) } : null)) ?? <IssueField>{id: 1, name: "Default" },
            status: normalizeField(raw.status) ?? <IssueField>{id: 1, name: "Default" },
            creator: normalizeUser(raw.creator) || { id: 0, username: (raw.creator_name || raw.author || 'unknown') },
            assignee: normalizeUser(raw.assignee || raw.assigned_to) || null,
            deadline: raw.deadline ?? null,
            created_at: raw.created_at || raw.created || new Date().toISOString(),
            modified_at: raw.modified_at || raw.modified || raw.updated_at || new Date().toISOString(),
            attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
            comments: Array.isArray(raw.comments) ? raw.comments : [],
            activities: Array.isArray(raw.activities) ? raw.activities : [],
            tags: Array.isArray(raw.tags) ? raw.tags : [],
            watchers: Array.isArray(raw.watchers) ? raw.watchers : []
        };

        try { console.debug('[fetchIssueDetail] normalized assignee:', normalized.assignee); } catch {};
        return normalized;
    } catch (error) {
        console.error("Error fetching issue details:", error);
        return null;
    }
}

// Modificar atributos de la issue (Subject, Status, etc.) via PUT
// Cambiamos Record<string, any> por Record<string, unknown>
export async function updateIssueFields(id: number, fields: Record<string, unknown>): Promise<boolean> {
    try {
        const res = await fetchWithTimeout(`${baseUrl}/issues/${id}/`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(fields),
        });
        return res.ok;
    } catch (error) {
        console.error("Error updating issue:", error);
        return false;
    }
}

export async function updateIssueAssignee(
    id: number,
    assigneeRef: string | number | null
): Promise<{ ok: boolean; status?: number; message?: string }> {
    try {
        const baseUrl = getApiBaseUrl();
        let payload: Record<string, unknown>;
        if (assigneeRef == null || assigneeRef === '') {
            payload = { user_id: null };
        } else if (typeof assigneeRef === 'number' || (!isNaN(Number(assigneeRef)) && String(assigneeRef).trim() !== '')) {
            payload = { user_id: Number(assigneeRef) };
        } else {
            payload = { user_id: String(assigneeRef) };
        }

        const endpoints = [
            `${baseUrl}/issues/${id}/assignee/`,
            `${baseUrl}/issue/${id}/update-assignee/`
        ];

        let lastStatus: number | undefined;
        let lastMessage = '';

        for (const endpoint of endpoints) {
            try {
                console.debug('[updateIssueAssignee] PUT', endpoint, 'payload:', payload);
            } catch {}

            const res = await fetchWithTimeout(endpoint, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify(payload),
            });

            let textBody = '';
            try {
                textBody = await res.text();
                try { console.debug('[updateIssueAssignee] response', res.status, textBody); } catch {}
            } catch (e) {
                try { console.debug('[updateIssueAssignee] response reading failed', e); } catch {}
            }

            if (res.ok) return { ok: true };

            // If server errored (5xx) when sending a numeric id, try string username fallback once
            if ((res.status >= 500 && res.status < 600) && typeof payload.user_id === 'number') {
                try {
                    const fallbackUser = getUserById(Number(payload.user_id));
                    if (fallbackUser) {
                        const fallbackPayload = { user_id: String(fallbackUser.username) };
                        try { console.debug('[updateIssueAssignee] retrying with username fallback', endpoint, fallbackPayload); } catch {}
                        const retryRes = await fetchWithTimeout(endpoint, {
                            method: 'PUT',
                            headers: getHeaders(),
                            body: JSON.stringify(fallbackPayload),
                        });
                        let retryText = '';
                        try { retryText = await retryRes.text(); } catch {}
                        try { console.debug('[updateIssueAssignee] retry response', retryRes.status, retryText); } catch {}
                        if (retryRes.ok) return { ok: true };
                        // otherwise, treat retry failure as the final error for this endpoint
                    }
                } catch (e) {
                    try { console.debug('[updateIssueAssignee] username fallback failed', e); } catch {}
                }
            }

            lastStatus = res.status;
            try {
                const parsed = JSON.parse(textBody || '{}');
                if (parsed?.message) lastMessage = String(parsed.message);
                else if (parsed?.error) lastMessage = String(parsed.error);
                else if (textBody) lastMessage = String(textBody).slice(0, 200);
            } catch {
                if (textBody) lastMessage = String(textBody).slice(0, 200);
            }

            // If endpoint exists but request failed for another reason, stop here.
            if (res.status !== 404) {
                break;
            }
        }

        return {
            ok: false,
            status: lastStatus,
            message: lastMessage || 'Could not update assignee'
        };
    } catch (error) {
        console.error("Error updating assignee:", error);
        return { ok: false, message: error instanceof Error ? error.message : 'Request failed' };
    }
}

// Eliminar por completo la Issue via DELETE
export async function deleteIssue(id: number): Promise<boolean> {
    try {
        const res = await fetchWithTimeout(`${baseUrl}/issues/${id}/`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        return res.ok;
    } catch (error) {
        console.error("Error deleting issue:", error);
        return false;
    }
}

// Añadir watcher <userId> a issue <issueId>
export async function addWatcher(issueId: number, userId: number): Promise<boolean> {
    try {
        const res = await fetch(`${BASE_URL}/issues/${issueId}/watchers/`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ user_id: userId }),
        });
        return res.ok;
    } catch (error) {
        console.error("Error adding watcher:", error);
        return false;
    }
}

// Eliminar watcher <watcherId> de la issue <issueId>
export async function deleteWatcher(issueId: number, watcherId: number): Promise<boolean> {
    try {
        const res = await fetch(`${BASE_URL}/issues/${issueId}/watchers/${watcherId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        return res.ok;
    } catch (error) {
        console.error("Error deleting watcher:", error);
        return false;
    }
}

// --- CRUD DE COMENTARIOS ---

// Añadir comentario
export async function addComment(issueId: number, body: string): Promise<boolean> {
    try {
        const res = await fetchWithTimeout(`${baseUrl}/issues/${issueId}/comments/`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ body }),
        });
        return res.ok;
    } catch (error) {
        console.error("Error adding comment:", error);
        return false;
    }
}

// Editar comentario existente
export async function editComment(commentId: number, body: string): Promise<boolean> {
    try {
        const res = await fetchWithTimeout(`${baseUrl}/comments/${commentId}/`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ body }),
        });
        return res.ok;
    } catch (error) {
        console.error("Error editing comment:", error);
        return false;
    }
}

// Eliminar comentario
export async function deleteComment(commentId: number): Promise<boolean> {
    try {
        const res = await fetchWithTimeout(`${baseUrl}/comments/${commentId}/`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        return res.ok;
    } catch (error) {
        console.error("Error deleting comment:", error);
        return false;
    }
}

export async function addAttachment(issueId: number, body: FormData): Promise<boolean> {
    try {
        const res = await fetchWithTimeout(`${baseUrl}/issues/${issueId}/attachments`, {
            method: 'POST',
            headers: {
                'Authorization': getStoredApiKey() ?? '',
            },
            body: body
        });
        return res.ok;
    } catch (error) {
        console.error("Error adding attachment:", error);
        return false;
    }
}

export async function deleteAttachment(attachmentId: number): Promise<boolean> {
    try {
        const res = await fetchWithTimeout(`${baseUrl}/attachments/${attachmentId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        return res.ok;
    } catch (error) {
        console.error("Error deleting attachment:", error);
        return false;
    }
}