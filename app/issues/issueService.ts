import { fetchWithTimeout } from "../lib/fetchWithTimeout";
import {getApiBaseUrl, getFormDataHeaders, getHeaders} from "../lib/apiBaseUrl";
import {Issue} from "@/app/issues/page";

export interface IssueFilterState {
    search: string;
    order_by: string;
    issue_type: string[];
    issue_severity: string[];
    priority: string[];
    status: string[];
    assigned_to: string[];
}

export interface IssueStatusField {
    id?: number;
    name: string;
    color?: string;
}

export interface IssueListResult {
    issues: Record<string, unknown>[];
    total_count: number;
    type_counts: Record<string, number>;
    severity_counts: Record<string, number>;
    priority_counts: Record<string, number>;
    status_counts: Record<string, number>;
    assigned_to_counts: Record<string, number>;
    error?: string;
}

const TYPE_COLORS: Record<string, string> = {
    'Bug': '#E44057',
    'Question': '#4070E4',
    'Enhancement': '#40E4CE'
};

const SEVERITY_COLORS: Record<string, string> = {
    'Wishlist': '#70728F',
    'Minor': '#40A8E4',
    'Normal': '#40E4A8',
    'Important': '#E4A840',
    'Critical': '#E44057'
};

const STATUS_COLORS: Record<string, string> = {
    'New': '#70728F',
    'In Progress': '#40A8E4',
    'Ready for test': '#E4CE40',
    'Closed': '#A8E440',
    'Needs Info': '#E44057',
    'Rejected': '#A0A0B0',
    'Postponed': '#4070E4'
};

const baseUrl = getApiBaseUrl();


function orderIssues(parameter: string) {
    let direction = 1
    if (parameter.startsWith('-')) {
        direction = -1
        parameter = parameter.substring(1)
    }
    return function(a: any, b: any) {
        if (parameter === "subject") {
            if (a["id"] > b["id"]) return direction
            if (a["id"] < b["id"]) return -1 * direction
            return 0
        } else if (parameter === "deadline") {
            if (!a["deadline"] || a["deadline"] > b["deadline"]) return direction
            if (!b["deadline"] || a["issue"] < b["issue"]) return -1 * direction
            return 0
        } else if (a[parameter]?.name) {
            if (a[parameter].name > b[parameter].name) return direction
            if (a[parameter].name < b[parameter].name) return -1 * direction
            return 0
        } else {
            if (a[parameter] > b[parameter]) return direction
            if (a[parameter] < b[parameter]) return -1 * direction
            return 0
        }
    }
}

export function filterIssues(filters: IssueFilterState, issues: Issue[]) {
    let filteredIssues: Issue[] = issues.slice()

    if (filters.search.length > 0)
        filteredIssues = filteredIssues.filter((issue) => issue.subject?.includes(filters.search) ||
                                                                 issue.description?.includes(filters.search) ||
                                                                 String(issue.id).includes(filters.search))

    if (filters.issue_type.length > 0)
        filteredIssues = filteredIssues.filter(issue => filters.issue_type.includes(issue.type?.name ?? ""))

    if (filters.issue_severity.length > 0)
        filteredIssues = filteredIssues.filter(issue => filters.issue_severity.includes(issue.severity?.name ?? ""))

    if (filters.priority.length > 0)
        filteredIssues = filteredIssues.filter(issue => filters.priority.includes(issue.priority ?? ""))

    if (filters.status.length > 0)
        filteredIssues = filteredIssues.filter(issue => filters.status.includes(issue.status?.name ?? ""))

    if (filters.assigned_to.length > 0)
        filteredIssues = filteredIssues.filter(issue => filters.assigned_to.includes(issue.assignee ?? "Unassigned"))

    if (filters.order_by) filteredIssues.sort(orderIssues(filters.order_by))

    return filteredIssues
}

export async function getIssues(): Promise<IssueListResult> {
    try {
        const response = await fetchWithTimeout(`${getApiBaseUrl()}/issues/`, {
            method: 'GET',
            headers: getHeaders()
        });

        if (!response.ok) {
            let errorMessage = `Error al conectar con la API REST (Status: ${response.status})`;
            try {
                const payload = await response.json();
                if (payload?.message) {
                    errorMessage = String(payload.message);
                }
            } catch {
                // Keep the status-based message when the backend body is not JSON.
            }

            return {
                issues: [],
                total_count: 0,
                type_counts: {},
                severity_counts: {},
                priority_counts: {},
                status_counts: {},
                assigned_to_counts: {},
                error: errorMessage
            };
        }

        const data = await response.json();
        const rawIssues = (data.issues || []) as Record<string, unknown>[];

        const type_counts: Record<string, number> = {};
        const severity_counts: Record<string, number> = {};
        const priority_counts: Record<string, number> = {};
        const status_counts: Record<string, number> = {};
        const assigned_to_counts: Record<string, number> = {};

        const correctedIssues = rawIssues.map((issue: Record<string, unknown>) => {
            const capitalize = (str: unknown): string => {
                if (!str) return '';
                const val = String(str).trim();
                if (!val) return '';
                return val
                    .split(' ')
                    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                    .join(' ');
            };

            const typeName = capitalize(issue.issue_type);
            const sevName = capitalize(issue.severity);
            const priorityName = capitalize(issue.priority);
            const statusName = capitalize(issue.status);
            const assignedValue = capitalize(issue.assignee || 'Unassigned');

            const increment = (counterObj: Record<string, number>, keyName: string) => {
                if (!keyName) return;
                counterObj[keyName] = (counterObj[keyName] || 0) + 1;
                counterObj[keyName.toLowerCase()] = (counterObj[keyName.toLowerCase()] || 0) + 1;
            };

            increment(type_counts, typeName);
            increment(severity_counts, sevName);
            increment(priority_counts, priorityName);
            increment(status_counts, statusName);
            increment(assigned_to_counts, assignedValue);

            const typeField: IssueStatusField = { name: typeName, color: TYPE_COLORS[typeName] || '#70728F' };
            const severityField: IssueStatusField = { name: sevName, color: SEVERITY_COLORS[sevName] || '#70728F' };
            const statusField: IssueStatusField = { name: statusName, color: STATUS_COLORS[statusName] || '#70728F' };

            return {
                ...issue,
                type: typeField,
                severity: severityField,
                status: statusField,
                priority: priorityName,

                issue_type: typeName,
                issue_severity: sevName,
                issue_priority: priorityName,
                assigned_to: assignedValue
            };
        });

        return {
            issues: correctedIssues,
            total_count: correctedIssues.length,
            type_counts,
            severity_counts,
            priority_counts,
            status_counts,
            assigned_to_counts
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Error de sincronización.';
        return {
            issues: [],
            total_count: 0,
            type_counts: {},
            severity_counts: {},
            priority_counts: {},
            status_counts: {},
            assigned_to_counts: {},
            error: message
        };
    }
}

export async function createIssue(body: FormData) {
    return await fetchWithTimeout(`${baseUrl}/issues/`, {
        method: 'POST',
        headers: getFormDataHeaders(),
        body: body
    });
}

export async function createIssueBulk(list: string[]) {
    return await fetch(`${baseUrl}/issues/bulk/`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({list})
    });
}

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