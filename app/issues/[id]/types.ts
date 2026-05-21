export interface UserProfile {
    id: number;
    username: string;
    avatar_url?: string;
}

export interface IssueField {
    id: number;
    name: string;
    color?: string;
}

export interface Attachment {
    id: number;
    issue_id: number;
    creator_id: number;
    url: string;
    name: string;
}

export interface Activity {
    id: number;
    actor: string;
    field_name: string;
    old_value: string | null;
    new_value: string | null;
    created_at: string;
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

export interface IssueDetailData {
    id: number;
    subject: string;
    description: string | null;
    issue_type: IssueField;
    severity: IssueField;
    priority: IssueField;
    status: IssueField;
    creator: UserProfile;
    assignee: UserProfile | null;
    deadline: string | null;
    created_at: string;
    modified_at: string;
    attachments: Attachment[];
    comments: Comment[];
    activities: Activity[];
    tags: Tag[];
    watchers: UserProfile[];
}