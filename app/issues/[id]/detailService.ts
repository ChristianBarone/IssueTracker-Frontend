import { IssueDetailData } from './types';

const BASE_URL = 'https://issuetracker-ff8u.onrender.com';
const API_KEY = 'Mxk4bUdzGtId8imUNgVKHUiheNKT4AKl';

const getHeaders = () => ({
    'Authorization': API_KEY,
    'Content-Type': 'application/json',
});

// Obtener los detalles de una issue por ID
export async function fetchIssueDetail(id: number): Promise<IssueDetailData | null> {
    try {
        const res = await fetch(`${BASE_URL}/issues/${id}/`, {
            method: 'GET',
            headers: getHeaders(),
            cache: 'no-store' // Para que siempre traiga comentarios frescos
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (error) {
        console.error("Error fetching issue details:", error);
        return null;
    }
}

// Modificar atributos de la issue (Subject, Status, etc.) via PUT
// Cambiamos Record<string, any> por Record<string, unknown>
export async function updateIssueFields(id: number, fields: Record<string, unknown>): Promise<boolean> {
    try {
        const res = await fetch(`${BASE_URL}/issues/${id}/`, {
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
        const res = await fetch(`${BASE_URL}/issues/${id}/`, {
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
        const res = await fetch(`${BASE_URL}/issues/${issueId}/comments/`, {
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
        const res = await fetch(`${BASE_URL}/comments/${commentId}/`, {
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
        const res = await fetch(`${BASE_URL}/comments/${commentId}/`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        return res.ok;
    } catch (error) {
        console.error("Error deleting comment:", error);
        return false;
    }
}