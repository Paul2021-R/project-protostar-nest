import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private readonly prisma: PrismaService) { }

  getHello(): string {
    return 'Hello World!';
  }

  // DB 연결 테스트용 함수
  async testDbConnection() {
    // 1. 테스트 데이터 생성
    await this.prisma.testUser.create({
      data: { name: `User-${Date.now()}` },
    });

    // 2. 전체 데이터 조회
    const users = await this.prisma.testUser.findMany();
    return {
      message: 'DB Connection Success!',
      totalUsers: users.length,
      users: users,
    };
  }
}
