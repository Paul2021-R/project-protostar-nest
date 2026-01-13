import { Role, User } from "@prisma/client";
import { Exclude, Expose } from "class-transformer";

// NestJS 표준 방식으로 application level 에서 데이터 입출력 통제
export class UserDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  name?: string;

  @Exclude()
  password: string;

  @Expose()
  role: Role;

  @Expose()
  createdAt: Date;

  constructor(dto: User) {
    this.id = dto.id;
    this.email = dto.email;
    // Interceptor 가 알아서 컷함
    this.password = dto.password;
    this.name = dto.name || undefined;
    this.role = dto.role;
    this.createdAt = dto.createdAt;
  }
}