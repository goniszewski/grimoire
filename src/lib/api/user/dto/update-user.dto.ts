import type { User } from "$lib/interfaces/User.interface";

export interface UpdateUserDto extends Partial<Pick<User, "username" | "name" | "email" | "password" | "avatar" >> {}
