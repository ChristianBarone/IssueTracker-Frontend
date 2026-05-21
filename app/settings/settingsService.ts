import { fetchWithTimeout } from '../lib/fetchWithTimeout';
import { getApiBaseUrl } from '../lib/apiBaseUrl';

export type EntityType = 'statuses' | 'priorities' | 'types' | 'severities' | 'tags' | 'due-dates';

export interface BaseEntity {
    id: number;
    name: string;
    color: string;
    order?: number;
}

export interface StatusEntity extends BaseEntity {
    slug: string;
    is_closed: boolean;
    is_default: boolean;
}

export interface OrderedDefaultEntity extends BaseEntity {
    is_default: boolean;
}

export interface TagEntity extends BaseEntity {}

export interface DueDateEntity extends BaseEntity {
    days_offset: number;
    before_or_after: 'before' | 'after';
}

export type AnyEntity = StatusEntity | OrderedDefaultEntity | TagEntity | DueDateEntity;

function buildHeaders(apiKey: string, withContentType = true): Record<string, string> {
    const h: Record<string, string> = {
        Accept: 'application/json',
        Authorization: apiKey,
    };
    if (withContentType) h['Content-Type'] = 'application/json';
    return h;
}

function extractError(payload: unknown, status: number): string {
    if (payload && typeof payload === 'object') {
        const p = payload as Record<string, unknown>;
        return String(p.detail ?? p.message ?? JSON.stringify(payload));
    }
    return `Error ${status}`;
}

export async function fetchEntities(entity: EntityType, apiKey: string): Promise<AnyEntity[]> {
    try {
        const res = await fetchWithTimeout(`${getApiBaseUrl()}/settings/${entity}/`, {
            method: 'GET',
            headers: buildHeaders(apiKey, false),
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : (data.results ?? []);
    } catch {
        return [];
    }
}

export async function createEntity(
    entity: EntityType,
    data: Record<string, unknown>,
    apiKey: string
): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await fetchWithTimeout(`${getApiBaseUrl()}/settings/${entity}/`, {
            method: 'POST',
            headers: buildHeaders(apiKey),
            body: JSON.stringify(data),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: extractError(payload, res.status) };
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
}

export async function updateEntity(
    entity: EntityType,
    id: number,
    data: Record<string, unknown>,
    apiKey: string
): Promise<{ ok: boolean; error?: string }> {
    try {
        const res = await fetchWithTimeout(`${getApiBaseUrl()}/settings/${entity}/${id}/`, {
            method: 'PUT',
            headers: buildHeaders(apiKey),
            body: JSON.stringify(data),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, error: extractError(payload, res.status) };
        return { ok: true };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
}

export async function deleteEntity(
    entity: EntityType,
    id: number,
    apiKey: string,
    replacementId?: number
): Promise<{ ok: boolean; error?: string }> {
    try {
        const url = replacementId != null
            ? `${getApiBaseUrl()}/settings/${entity}/${id}/?replacement_id=${replacementId}`
            : `${getApiBaseUrl()}/settings/${entity}/${id}/`;
        const res = await fetchWithTimeout(url, {
            method: 'DELETE',
            headers: buildHeaders(apiKey, false),
        });
        if (res.ok || res.status === 204) return { ok: true };
        const payload = await res.json().catch(() => ({}));
        return { ok: false, error: extractError(payload, res.status) };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
}

export async function moveEntityUp(entity: EntityType, id: number, apiKey: string): Promise<boolean> {
    try {
        const res = await fetchWithTimeout(`${getApiBaseUrl()}/settings/${entity}/${id}/move-up/`, {
            method: 'POST',
            headers: buildHeaders(apiKey, false),
        });
        return res.ok;
    } catch {
        return false;
    }
}

export async function moveEntityDown(entity: EntityType, id: number, apiKey: string): Promise<boolean> {
    try {
        const res = await fetchWithTimeout(`${getApiBaseUrl()}/settings/${entity}/${id}/move-down/`, {
            method: 'POST',
            headers: buildHeaders(apiKey, false),
        });
        return res.ok;
    } catch {
        return false;
    }
}
