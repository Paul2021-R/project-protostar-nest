# Protostar NestJS (Main Backend)

**Project Protostar**의 메인 백엔드 서비스로, API Gateway 역할과 핵심 비즈니스 로직을 담당합니다. 
유저 관리, 인증/인가(Auth), 채팅 세션 관리, 그리고 AI Worker(FastAPI)와의 비동기 통신을 처리합니다.

## 🏗 아키텍처 (Architecture)

본 프로젝트는 **고가용성 온프레미스 AI 서비스(V2.2.1)**의 일환으로 Docker Compose 기반의 마이크로서비스 환경에서 동작합니다.

### 핵심 역할
1.  **API Gateway**: 클라이언트(Next.js)의 모든 요청을 수신하고 처리합니다.
2.  **Authentication**: Guest -> Stargazer -> Protostar 로 이어지는 성장형 권한 체계를 관리합니다 (`AuthGuard`).
3.  **Data Management**: Prisma를 통해 PostgreSQL(User, Chat Log)과 상호작용합니다.
4.  **Async Queue Producer**: Redis(BullMQ)를 통해 AI 작업 요청을 `protostar-fastapi`로 전달합니다.

### 기술 스택 (Tech Stack)
-   **Framework**: NestJS (TypeScript)
-   **Database**: PostgreSQL (via Prisma ORM)
-   **Cache & Queue**: Redis (BullMQ for Job Queue, Cache for Rate Limiting)
-   **Container**: Docker

---

## 📂 프로젝트 구조 (Project Structure)

```
src/
├── common/          # 공통 모듈 (Filters, Guards, Interceptors)
├── features/        # 핵심 비즈니스 기능
│   └── chat/        # 채팅 관련 로직 (메시지 저장, 큐 발행 등)
├── prisma/          # Prisma Service 및 설정
└── main.ts          # 앱 진입점
```

---

## 🚀 시작하기 (Getting Started)

### 사전 요구사항 (Prerequisites)
- Node.js (v18+)
- Docker & Docker Compose
- PostgreSQL & Redis (로컬 실행 시)

### 설치 및 실행 (Installation & Run)

#### 1. 환경 설정
`init.env` 혹은 `.env.example`을 참고하여 `.env` 파일을 생성합니다.

```bash
# .env 예시
DATABASE_URL="postgresql://user:password@localhost:5432/protostar?schema=public"
REDIS_HOST="localhost"
REDIS_PORT=6379
```

#### 2. 로컬 개발 모드 실행
```bash
# 의존성 설치
pnpm install

# Prisma Generate (DB 스키마 동기화)
pnpm run prisma:generate

# 서버 실행
pnpm start:dev
```

#### 3. 배포 
app 폴더 상위 루트는 production 을 위하여 준비된 구성입니다. 

---

## 🔗 관련 문서 (References)
- **AI Rules & Guide**: [docs/guide](../../docs/guide)
- **Architecture Note**: [ArchitectNote.md](../../docs/project-official/ArchitectNote.md)
