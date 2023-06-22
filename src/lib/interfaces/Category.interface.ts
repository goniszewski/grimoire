import type { User } from "./User.interface";

export interface Category {
    id: string;
    name: string;
    description: string;
    color: string;
    owner: User;
    parent: Category;
    archived: Date;
    public: Date;
    created: Date;
    updated: Date;
}