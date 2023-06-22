import type { FlowItem } from "./FlowItem.interface";
import type { User } from "./User.interface";

export interface Flow {
    id: string;
    name: string;
    description: string;
    hero_image: string;
    color: string;
    owner: User;
    flow_items: FlowItem[];
    importance: number;
    public?: Date;
    archived?: Date;
    deadline?: Date;
    created: Date;
    updated: Date;
}
 