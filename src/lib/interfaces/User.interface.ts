export interface User {
    id: string;
    username: string;
    name: string;
    email: string;
    password: string;
    avatar: string;
    is_admin: boolean;
    archived: Date;
    seen_last: Date;
    created: Date;
    updated: Date;
}