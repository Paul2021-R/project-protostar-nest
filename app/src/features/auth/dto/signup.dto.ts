import { Role } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";

export class SignupDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsString()
  roleKey?: string;
}