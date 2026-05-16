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

// Si estás probando en local en vez de producción, puedes cambiar temporalmente a http://localhost:8000
const BASE_URL = 'https://issuetracker-ff8u.onrender.com';

export async function getFilteredIssues(filters: IssueFilterState, apiKey: string) {
    try {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.order_by) params.append('order_by', filters.order_by);

        filters.issue_type.forEach(t => params.append('issue_type', t));
        filters.issue_severity.forEach(s => params.append('issue_severity', s));
        filters.priority.forEach(p => params.append('priority', p));
        filters.status.forEach(st => params.append('status', st));

        const url = `${BASE_URL}/issues/?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error("🔴 ¡ERROR DE LA API DETECTADO!");
            throw new Error(`Error al conectar con la API REST de Render (Status: ${response.status})`);
        }

        const data = await response.json();
        const rawIssues = (data.issues || []) as Record<string, any>[]; // Usamos any aquí para la transformación interna limpia

        const type_counts: Record<string, number> = {};
        const severity_counts: Record<string, number> = {};
        const priority_counts: Record<string, number> = {};
        const status_counts: Record<string, number> = {};
        const assigned_to_counts: Record<string, number> = {};

        const correctedIssues = rawIssues.map((issue: Record<string, any>) => {
            const capitalize = (str: any): string => {
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
                status: statusField, // Mapeado correctamente como objeto para que el componente no se quede en rojo
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
        console.error("Error en getFilteredIssues:", error);
        return { issues: [], total_count: 0, type_counts: {}, severity_counts: {}, priority_counts: {}, status_counts: {}, assigned_to_counts: {} };
    }
}

export async function updateIssueStatus(issueId: number, statusName: string, apiKey: string): Promise<boolean> {
    try {
        const response = await fetch(`${BASE_URL}/issue/${issueId}/update-status/`, {
            method: 'POST',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: statusName })
        });

        // Al cambiar esto, el 302/200 de Django se procesará y devolverá true, eliminando la alerta de error.
        return response.ok || response.status === 302;
    } catch (error) {
        console.error("Error al actualizar estado en la API:", error);
        return false;
    }
}