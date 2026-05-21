export interface Attachment {
    id: number;
    issue_id: number;
    creator_id: number;
    url: string;
    name: string;
}

// API returns: { id, user, field, old, new, date }
export interface Activity {
    id: number;
    user: string;
    field: string;
    old: string | null;
    new: string | null;
    date: string;
}

export interface Comment {
    id: number;
    author: string;
    body: string;
    created_at: string;
}

export interface Tag {
    id: number;
    name: string;
    color: string;
}

// All fields (status, priority, severity, type, creator, assignee)
// are returned as plain strings by the API, not nested objects.
export interface IssueDetailData {
    id: number;
    subject: string;
    description: string | null;
    type: string;           // GET field name is "type" (PUT uses "issue_type")
    severity: string;
    priority: string;
    status: string;
    creator: string;        // plain username string
    assignee: string;       // plain username string or "Unassigned"
    deadline: string | null;
    created_at: string;
    modified_at: string;
    attachments: Attachment[];
    comments: Comment[];
    activities: Activity[];
    tags: Tag[];
    watchers: string[];
}
