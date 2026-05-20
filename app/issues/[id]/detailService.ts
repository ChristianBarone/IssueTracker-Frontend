import { fetchWithTimeout } from '../../lib/fetchWithTimeout';
import { getStoredApiKey } from '../../lib/auth';
import { getApiBaseUrl } from '../../lib/apiBaseUrl';
import { IssueDetailData } from './types';

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
        const raw = await res.json();

        // Normalize common backend variations so the UI has consistent shapes
        const normalizeUser = (u: any) => {
            if (!u) return null;
            if (typeof u === 'string') return { id: 0, username: u.replace('@', '') };
            if (u.username) return u;
            return null;
        };

        const normalizeField = (f: any) => {
            if (!f) return null;
            if (typeof f === 'string') return { id: 0, name: f };
            if (f.name) return f;
            return null;
        };

        const normalized: IssueDetailData = {
            id: Number(raw.id),
            subject: raw.subject || '',
            description: raw.description ?? null,
            issue_type: normalizeField(raw.issue_type || raw.type),
            severity: normalizeField(raw.severity),
            priority: normalizeField(raw.priority || raw.issue_priority) || (raw.priority ? { id: 0, name: String(raw.priority) } : null),
            status: normalizeField(raw.status),
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
        const baseUrl = getApiBaseUrl();
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

// Eliminar por completo la Issue via DELETE
export async function deleteIssue(id: number): Promise<boolean> {
    try {
        const baseUrl = getApiBaseUrl();
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

// --- CRUD DE COMENTARIOS ---

// Añadir comentario
export async function addComment(issueId: number, body: string): Promise<boolean> {
    try {
        const baseUrl = getApiBaseUrl();
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
        const baseUrl = getApiBaseUrl();
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
        const baseUrl = getApiBaseUrl();
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