import 'next-auth';
import { Role, UserStatus } from '@prisma/client';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      status: UserStatus;
    };
  }
  interface User {
    id: string;
    email: string;
    name: string;
    role: Role;
    status: UserStatus;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    role?: Role;
    status?: UserStatus;
  }
}
