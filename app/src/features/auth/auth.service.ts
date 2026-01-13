import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { PrismaService } from "src/common/prisma/prisma.service";
import { SignupDto } from "./dto/signup.dto";
import { Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { UserDto } from "./dto/user.dto";
import { SigninDto } from "./dto/signin.dto";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
  }

  async signup(dto: SignupDto) {
    const { email, password, role, roleKey } = dto;

    const existingUser = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    if (role === Role.ADMIN) {
      if (roleKey !== this.configService.get<string>('ROLE_KEY')) {
        this.logger.warn(`Failed admin signup attempt for ${email}`);
        throw new ForbiddenException("Invalid Admin role key");
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role,
      }
    })

    return new UserDto(user);
  }

  async signin(dto: SigninDto) {
    const { email, password } = dto;

    const user = await this.prisma.user.findUnique({
      where: {
        email,
      },
    });

    if (!user || !await bcrypt.compare(password, user.password)) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    }

    const token = this.jwtService.sign(payload);

    return {
      user: new UserDto(user),
      access_token: token,
    }
  }
}
