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

// Mapeos usando las claves exactas tal cual viajan en tu formulario (Primera letra Mayúscula)
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

// Quitamos el subpath '/api' según tus especificaciones de funcionamiento
const BASE_URL = 'https://issuetracker-ff8u.onrender.com';

export async function getFilteredIssues(filters: IssueFilterState, apiKey: string) {
    try {
        const params = new URLSearchParams();
        if (filters.search) params.append('search', filters.search);
        if (filters.order_by) params.append('order_by', filters.order_by);

        // Django espera las variables de los filtros con los nombres de tu API
        filters.issue_type.forEach(t => params.append('issue_type', t));
        filters.issue_severity.forEach(s => params.append('issue_severity', s));
        filters.priority.forEach(p => params.append('priority', p));
        filters.status.forEach(st => params.append('status', st));

        // Ruta corregida sin /api y añadiendo la barra final estricta
        const url = `${BASE_URL}/issues/?${params.toString()}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                // Modificado: Se envía el API Key limpio sin prefijos (Igual que en tu Create)
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            console.error("🔴 ¡ERROR DE LA API DETECTADO!");
            console.error(`Status Code: ${response.status} (${response.statusText})`);
            console.error(`URL solicitada: ${url}`);
            try {
                const errorBody = await response.text();
                console.error("Cuerpo del error del Backend:", errorBody);
            } catch (e) {
                console.error("No se pudo leer el cuerpo del error.");
            }
            throw new Error(`Error al conectar con la API REST de Render (Status: ${response.status})`);
        }

        const data = await response.json();
        const rawIssues = Array.isArray(data) ? data : (data.issues || []);

        const correctedIssues = rawIssues.map((issue: any) => {
            // Helper para capitalizar la primera letra y mapear correctamente con los diccionarios de colores
            const capitalize = (str: any) => {
                const val = (str?.name || str || '').toString().trim();
                if (!val) return '';
                return val.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
            };

            const typeName = capitalize(issue.issue_type || issue.type);
            const sevName = capitalize(issue.issue_severity || issue.severity);
            const statusName = capitalize(issue.status);

            return {
                ...issue,
                // Respetamos los nombres de propiedades que usa el backend mapeando los colores correspondientes
                type: typeof issue.type === 'object' ? { ...issue.type, color: TYPE_COLORS[typeName] || issue.type.color } : { name: typeName, color: TYPE_COLORS[typeName] },
                severity: typeof issue.severity === 'object' ? { ...issue.severity, color: SEVERITY_COLORS[sevName] || issue.severity.color } : { name: sevName, color: SEVERITY_COLORS[sevName] },
                status: typeof issue.status === 'object' ? { ...issue.status, color: STATUS_COLORS[statusName] || issue.status.color } : { name: statusName, color: STATUS_COLORS[statusName] }
            };
        });

        return {
            issues: correctedIssues,
            total_count: data.total_count || correctedIssues.length,
            type_counts: data.type_counts || {},
            severity_counts: data.severity_counts || {},
            status_counts: data.status_counts || {}
        };
    } catch (error) {
        console.error("Error en getFilteredIssues:", error);
        return { issues: [], total_count: 0, type_counts: {}, severity_counts: {}, status_counts: {} };
    }
}

export async function updateIssueStatus(issueId: number, statusName: string, apiKey: string): Promise<boolean> {
    try {
        const response = await fetch(`${BASE_URL}/issues/${issueId}/`, {
            method: 'PATCH',
            headers: {
                'Authorization': apiKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: statusName })
        });

        return response.ok;
    } catch (error) {
        console.error("Error al actualizar estado en la API:", error);
        return false;
    }
}