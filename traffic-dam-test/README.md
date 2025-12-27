# Traffic Dam Test

## 개요
유량 제어의 기능의 효과, 제어 기능을 직접 구현함으로써 현재 개인이 진행중인 개인 프로젝트에 대한 안전성을 극한으로 끌어올려, 백엔드 개발자로서의 역량을 한층 강화 시키기, 서비스의 안전성을 책임지는 전문가로서 자리잡기 위한 나름의 도전을 해보게 되었다. 

## 기술 선정 
- k6 : 현재 사용하기 가장 용이한 Node 기반의 테스트 도구를 기반으로 스크립트를 통한 간단한 구성으로 효과적인 유량 제어 테스트 도구로 선택하게 되었다. CLI 기반으로 필요한 히스토리를 쉽게 확인할 수 있다는 점에서 선정 됨. Locust 도 활용 가능하나, CLI 환경의 온프레미스 서버에서 쓰기 용이하기 위함이다. 
- NestJS 서버 : 테스트 대상이 되는 서버. Redis 와 함께 Pub/Sub 구조로 구축되어 있으며, 이를 기반으로 FastAPI 가 LLM 특화 기능을 하는 것을 보좌하고 서비스를 유지한다. 
- FastAPI 서버 : AI 전담 서버로, Polyglot 전략으로 AI 의 특화된 도구들의 활용과 자료들을 바로바로 적용하기 용이하기에 선정됨. 
- Redis : Pub/Sub 구조를 활용한 데이터 파이프라인의 핵심 중추. 향후 AI 서버를 비롯한 모든 서버의 상태를 포함 제어 역할까지 할 중심 축인 인메모리 DB

## 기술 가설 
- 본 테스트는 '파괴'가 목적이다. 현재의 온프레미스의 서버 상에서 일정 수준으로 서비스 리소스를 분배한 상태. 이 상태에서 테스트 요청을 가했을 때, 정상적인 다중 접속, 비정상적인 어뷰징 접속 등을 검토하여 현 온프레미스 서버에서의 성능과 리소스의 특성을 파악하고, 향후 서버의 확장 혹은 리소스 추가를 위한 기반으로 삼음.
- 주요 가설 : 
    1. NestJS 게이트웨이, Redis 는 각가 512MB 로 배치 시켰으며, 이러한 최소 단위를 설정한 것은 스케일 아웃을 통한 확장 시를 감안한 각 인스턴스의 최소 수준을 의미한다. 
    2. AI 서버는 오로지 LLM 의 처리, RAG 처리 등 AI 특화 기능으로, 게이트웨이와는 완전히 별도로 독립되며, 실제로 유저의 state 를 완전히 생각하지 않으며 오로지 Redis 의 뒷편의 생산자 역할을 수행한다. 고로 물리적 데미지를 입을 가능성은 낮은 편이다. (향후 독립된 인스턴스로 만들면 더욱 명확하게 독립적이게 된다.)
        - 그러나 이때, AI 서버는 LLM 과 통신 과정에서 어느 정도 수준의 생산 소요 시간이 필요하고, 이 지점에서 NestJS 게이트웨이 서버와의 간극이 발생하고, 핸들링이 필요해진다고 판단된다. 
    3. 이러한 전제 하에 유입량의 Before Test 는 NestJS 서버에서의 큐, 요청 대기열 등 아무런 준비가 안된 상태에선 NestJS 부터 시작하여 문제가 발생 및 Redis 까지 문제가 전파될 수 있으리라 판단됨. 

## 테스트 전략 
- 타겟 : NestJS 게이트웨이 
- 목표 : 응답 불가가 발생하는 정확한 임계점(VUs) 파악하기
- 주요 부하 지점 : 
    1. Memory Leak / OOM
    2. Event Loop Blocking
    3. Redis Memory Limit : 근본적으론 OOM 이지만 구분차 포함함
- 테스트 시나리오 : AI 서버가 100 TPS 기준으로 요청 처리가 가능하다는 전제 하에 
    - SSE GET 요청 보내기 -> 연결 유지 -> POST 로 모의 질문 보내기 -> 응답 받기 -> 연결 종료 의 한 사이클을 기반으로 진행함
- 기본 시나리오 
    1. 일반 유저 시나리오 : 점진적 증가 -> 스파이크 
        1. 0명 -> 100명 (30초) : 기본 연결 테스트
        2. 100 -> 500 (1분)
        3. 500 -> 1000 (2분)
        4. 1000 -> 2000 (1분) : 예상 서버 다운 구간
        5. 2000 -> 0 (30초)
    2. 악성 유저 시나리오 : 매크로 연사
        - 구성유저 일단 5명 
        - 공격 빈도 : 0.05 초(50ms) 마다 요청 발성 -> 총 부하는 초당 100 req 수준

## 테스트 진행 필수 사항

1. 테스트 환경 설치 (debian 계열)

```shell
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

2. k6 스크립트 실행 

```shell
k6 run script.js 2> error_log.txt # 에러 로그 파일 저장을 위한 stderr 활용 파이프
```

3. NestJS 서버 설정 
- `Too many open files` 에러 발생을 미연에 막고자 ubuntu 시스템의 FD 제한을 해제할 것 

```shell
ulimit -n 65535
```

4. 모니터링 준비 사항 

    1. 실시간 로그 : `docker logs -f <container_name>`
    2. 리소스 모니터링 : `docker stats`
    3. 사실 현재 쓰기 가장 좋은 것 : Grfana 대시보드 활용 가능

## 1차 Before Test 결과

### 1. 테스트 개요 및 환경

* **목적**: 트래픽 제어(Traffic Dam) 로직이 없는 순수 상태(Raw)의 서버가 감당할 수 있는 **물리적/소프트웨어적 임계점(Capacity Limit)** 확인.
* **환경**:
* **H/W**: Ryzen 7430U (6C/12T), On-Premise.
* **S/W**: Docker Container (NestJS Single Instance, Nginx Reverse Proxy).
* **제한**: CPU/Memory 제한 없음 (Host 자원 공유).


* **사용 스크립트**: `scenarioLifecycle` (SSE 연결 -> POST 질문 -> 응답 대기 -> 종료)

### 2. 시나리오별 결과 요약

#### A. [Scenario 0] Constant VUs (동시 접속 1,100명 유지) - **Fail** ❌

* **결과**: `http_req_duration` P95 **9초** 지연 발생, `status_0` (Timeout) 에러 다수 발생.
* **현상**:
* 1,000명까지는 처리가 되나, 1,100명이 동시에 접속을 시도하는 순간 대기열(Queue)이 폭발.
* 사용자는 연결 수립에만 9초 이상 대기하다가 타임아웃으로 이탈.
* **결론**: 현재 단일 인스턴스의 동시 처리 한계는 **약 1,000명**으로 확인.



#### B. [Scenario 1] Ramping VUs (0 -> 2,000명 점진적 증가) - **Conditional Pass** ⚠️

* **결과**: 에러율 0%로 통과했으나, **최대 지연 시간(Max Latency) 5분** 기록.
* **현상**:
* 서서히 유입될 경우(Ramping) 처리 속도가 유입 속도를 간신히 따라잡아 에러는 없었음.
* 하지만 P95(상위 5%) 유저는 수 분간 응답을 기다려야 했음 (사실상 서비스 불능).
* **결론**: "안 죽고 버티는 것"과 "서비스 가능한 것"은 다름을 확인.



#### C. [Scenario 2] Abuser (악성 유저 5명, 50ms 연사) - **Pass** ✅

* **결과**: P95 응답 속도 **0.06초(67ms)**, 처리량 초당 50 TPS 이상.
* **현상**: 소수의 유저가 빠르게 요청하는 것은 Non-blocking I/O 특성상 매우 효율적으로 처리함.
* **결론**: 서버의 적은 '속도'가 아니라 **'동시 접속자 수(Concurrency)'**임이 증명됨.

### 3. 심층 분석 (Deep Dive)

**Q. CPU가 남는데 왜 서버는 느려졌는가?**
모니터링 도구(`btop`, `docker stats`) 분석 결과, 두 가지 명확한 병목 지점이 발견됨.

1. **Nginx Bottleneck (CPU 118%)**:
* 1,100명의 HTTPS 암호화/복호화(SSL Handshake)를 처리하느라 Nginx가 가장 먼저 과부하에 걸림.
* 멀티 프로세스인 Nginx가 CPU 1코어 이상을 점유하며 입구에서부터 지연 발생.


2. **Node.js Event Loop Lag (CPU 48%)**:
* 싱글 스레드인 NestJS는 1개의 코어(약 8.3% 점유율)를 100% 사용 중이었으나, I/O 대기(Redis 통신 등)로 인해 전체 CPU 사용률은 48%에 머뭄.
* **의미**: CPU 자원이 남아도, 구조적으로 **싱글 인스턴스는 1,000명 이상의 동시 접속을 처리할 수 없음**을 수학적으로 증명.

### 4. 결론 및 Next Step (Traffic Dam 전략 수립)

현재 아키텍처(Single Instance)에서의 **최대 수용 가능 인원은 1,000명**으로 예상됨. 이를 초과하는 트래픽을 무작정 받을 경우, 기존 유저까지 9초 이상의 지연을 겪으며 서비스 전체 품질이 저하됨. 단, 이를 명확하게 하기 위해 CPU 의 코어수 제약을 걸어서, 최소 단위의 인스턴스 컨테이너를 구상하여 확실한 Before 테스트 결과를 정리할 예정. 이후 이를 기반으로 **Traffic Dam(유량 제어)** 설계를 적용하여 2차 테스트(After Test)를 진행할 예정임.

1. **Gatekeeper**: `CHAT_MAX_CONNECTIONS` 상수를 **1,000**으로 설정.
2. **Fail-Fast**: 1,001번째 유저부터는 대기시키지 않고 즉시 `429 Too Many Requests`를 반환하여 리소스 보호.
3. **Scale-Out**: 향후 2,000명 수용을 위해 인스턴스를 2개로 늘려보고 Redis를 통한 상태 공유(Atomic Operation) 검증.

Traffic Dam 구현을 위한 작업 목록 
1. Nginx 설정
2. Traffic Dam 보강 및 429 전달 가능하게 구현
3. Circuit Breaker 구현 및 503 전달 가능하게 구현
4. TTL 구현
5. DLQ(보너스) 로 실패 => 기록하도록 구현(걍 로깅으로라도 구현하면 되니까 loki 있으니)