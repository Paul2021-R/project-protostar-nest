import { sleep, check } from 'k6';
import http from 'k6/http';
import sse from "k6/x/sse"
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';
import { Counter, Trend } from 'k6/metrics';


const ai_response_time = new Trend('ai_response_time');
const ai_ttft = new Trend('ai_ttft');

const sseInitCount = new Counter('sse_init_count');   // Init 절차 성공 카운터
const sseMsgCount = new Counter('sse_msg_count');   // AI가 보낸 이벤트 카운터
const sseDoneCount = new Counter('sse_done_count'); // AI 보낸 Done 이벤트 카운터
const sseErrCount = new Counter('sse_err_count');   // SSE 에러 카운터

// 상태 코드별 카운터 정의
const status200 = new Counter('status_200_OK');
const status4xx = new Counter('status_4xx_ClientErr');
const status500 = new Counter('status_500_ServerErr');
const status502 = new Counter('status_502_BadGateway');
const status503 = new Counter('status_503_ServiceUnavail');
const statusOther = new Counter('status_Other');

function logErrorToFile(context, status, bodyOrError) {
    // 200번대(정상)가 아니면 무조건 기록
    if (status !== 200 && status !== 201) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            context: context,      // 'SSE_CONNECT', 'HTTP_POST' 등 위치
            status: status,        // 상태 코드 (0이면 타임아웃/네트워크 끊김)
            detail: bodyOrError,   // 서버가 보낸 메시지 (HTML or Text)
        };
        // console.error를 사용해 stderr로 보냄 -> 나중에 파일로 저장됨
        console.error(`ERROR_LOG_JSON:${JSON.stringify(errorLog)}`);

        // 카운터 증가 로직도 여기서 처리
        if (status >= 400 && status < 500) status4xx.add(1);
        else if (status === 500) status500.add(1);
        else if (status === 502) status502.add(1);
        else if (status === 503) status503.add(1);
        else statusOther.add(1); // 0번이나 504번은 여기로 옴
    } else {
        status200.add(1);
    }
}

// -----------------------------------------------------------------------
// 1. 설정 영역
// -----------------------------------------------------------------------
const BASE_URL = 'https://back-protostar.ddns.net';

export const options = {
    // 시스템 사망 판정 기준
    thresholds: {
        http_req_failed: ['rate<0.01'], // 에러율 1% 미만
        http_req_duration: ['p(95)<1000'], // 95%의 요청이 3초 이내
        ai_response_time: ['p(95)<15000'], // 전체 응답 시간 15초 이내
        ai_ttft: ['p(95)<5000'], // 첫 토큰 5초 이내
    },

    scenarios: {
        // [시나리오 0] API 테스트 
        // api_test: {
        //     executor: 'constant-vus',
        //     vus: 500,
        //     duration: '10s',
        //     exec: 'scenarioLifecycle',
        // },
        // [시나리오 1] 일반 유저: 정상적인 대화 사이클 (생각하는 시간 포함)
        step_1_normal_users: {
            executor: 'ramping-vus',
            startVUs: 0,
            stages: [
                { duration: '30s', target: 100 },  // Warming
                { duration: '1m', target: 600 },  // Load
                // { duration: '2m', target: 1000 }, // Stress
                // { duration: '1m', target: 2000 }, // Peak (서버 다운 예상 지점)
                { duration: '30s', target: 0 },    // Cool-down
            ],

            gracefulRampDown: '2m',
            gracefulStop: '2m',
            exec: 'scenarioLifecycle',
        },

        // step_1_5_normal_users_one_iter: {
        //     executor: 'per-vu-iterations',
        //     vus: 500,
        //     iterations: 1,  // VU당 딱 1번
        //     maxDuration: '2m',
        //     startTime: '0s',
        //     gracefulStop: '30s',
        //     exec: 'scenarioLifecycle',
        // },

        // [시나리오 2] 악성 유저: 5명이서 미친듯이 사이클을 돌림 (Thinking Time 없음)
        // *참고: SSE 연결/해제 비용까지 서버에 부하를 줌
        // step_2_abusers: {
        //     executor: 'constant-vus',
        //     vus: 5,
        //     duration: '5m',
        //     exec: 'scenarioAbuser',
        // },
    },
};

// -----------------------------------------------------------------------
// [핵심 로직] 유저 라이프사이클 (Connect -> Post -> Done -> Close)
// -----------------------------------------------------------------------
export function scenarioLifecycle() {
    const sessionId = `session-${randomString(10)}`;
    // const uuid = uuidv4();

    const url = `${BASE_URL}/api/v1/chat/stream/${sessionId}`;

    let myUuid = null;
    let isChatSent = false;
    let sseParams = {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    }

    let startTime = Date.now();
    let ttftReceived = false;


    const response = sse.open(url, sseParams, function (client) {

        // [추가] 30초 안전 타임아웃 추가, 비정상 pending 상태일 때 k6를 멈추지 않게 만들기 위한 도구
        // const timeout = setTimeout(() => {
        //     console.log('⏰ Timeout! Force closing SSE.');
        //     sseErrCount.add(1); // 에러 카운트 증가
        //     client.close();     // 강제 종료
        // }, 60000); // 30초 (원하는 시간으로 조절)

        client.on('open', function open() {
            // console.log('connected')
        })

        client.on('event', function (eventData) {

            if (!eventData.data || eventData.data === "") {
                // console.log('Skipping empty heartbeat/ping...');
                return;
            }
            let data;

            try {
                data = JSON.parse(eventData.data);
            } catch (error) {
                logErrorToFile('SSE_EVENT', 999, eventData.data);
                return;
            }

            // console.log(`type: ${data.type}`)
            // console.log(`uuid: ${data.uuid}`)
            // console.log(`sessionId: ${data.sessionId}`)
            // console.log(`message: ${data.message}`)


            myUuid = data.uuid;

            if (data.type === 'init') {
                // console.log('Init received')
                sseInitCount.add(1);

                let params = {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                }
                if (!isChatSent) {
                    const payload = JSON.stringify({
                        sessionId: sessionId,
                        uuid: myUuid,
                        mode: 'test',
                        content: `Lifecycle Test Message ${randomString(10)}`,
                        context: 'test',
                    });

                    const response = http.post(`${BASE_URL}/api/v1/chat/message`, payload, params);
                    // console.log(`response: ${response.body}`)
                    isChatSent = true;
                    const bodyPreview = response.body ? response.body.toString().substring(0, 200) : "No Body";
                    logErrorToFile('HTTP_POST_MSG', response.status, bodyPreview);
                }
                return;
            }

            if (data.type === 'heartbeat') {
                // console.log('Heartbeat received')
                sseMsgCount.add(1);
            }

            if (data.type === 'message' && !ttftReceived) {
                ai_ttft.add(Date.now() - startTime);
                ttftReceived = true;
                // console.log('Message received')
                sseMsgCount.add(1);
            }

            if (data.type === 'done') {
                // 정상 종료 시 타임아웃 제거
                // clearTimeout(timeout);
                ai_response_time.add(Date.now() - startTime);
                // console.log('Task Finished')
                sseDoneCount.add(1);
                client.close();
            }
        })

        client.on('error', function (error) {
            // 정상 종료 시 타임아웃 제거
            // clearTimeout(timeout);

            // console.log(error)
            sseErrCount.add(1);
        })
    })

    if (response) {
        const bodyStr = response.body ? response.body.toString().substring(0, 300) : "No Body";
        logErrorToFile('SSE_OPEN_REQ', response.status, bodyStr);
        sleep(1)
    }

    check(response, {
        'SSE connected status is 200': (r) => r && r.status === 200,
    });
}

// -----------------------------------------------------------------------
// [시나리오 2] 악성 유저 (쉴 새 없이 사이클 반복)
// -----------------------------------------------------------------------
export function scenarioAbuser() {
    // 로직은 동일하지만, k6 Executor 설정에 따라 
    // 이 함수는 끝나자마자 즉시 다시 실행됨 (Sleep 없음)
    scenarioLifecycle();

    // 50ms 간격으로 공격한다고 했으므로, 강제 딜레이
    sleep(0.05);
}