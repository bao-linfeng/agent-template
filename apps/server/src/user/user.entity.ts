export interface User {
  id: number;
  email: string;
  password: string;
  nickname: string;
}

export type PublicUser = Omit<User, 'password'>;
