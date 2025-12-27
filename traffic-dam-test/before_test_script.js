import { sleep } from 'k6';
import http from 'k6/http';
import sse from "k6/x/sse"
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// -----------------------------------------------------------------------
// 1. 설정 영역
// -----------------------------------------------------------------------
const BASE_URL = 'https://back-protostar.ddns.net';

export const options = {
    // 시스템 사망 판정 기준
    thresholds: {
        http_req_failed: ['rate<0.01'], // 에러율 1% 미만
        http_req_duration: ['p(95)<3000'], // 95%의 요청이 3초 이내
    },

    scenarios: {
        // [시나리오 0] API 테스트 
        api_test: {
            executor: 'constant-vus',
            vus: 1,
            duration: '1s',
            exec: 'scenarioLifecycle',
        },
        // // [시나리오 1] 일반 유저: 정상적인 대화 사이클 (생각하는 시간 포함)
        // normal_users: {
        //     executor: 'ramping-vus',
        //     startVUs: 0,
        //     stages: [
        //         { duration: '30s', target: 100 },  // Warming
        //         { duration: '1m', target: 500 },  // Load
        //         { duration: '2m', target: 1000 }, // Stress
        //         { duration: '1m', target: 2000 }, // Peak (서버 다운 예상 지점)
        //         { duration: '30s', target: 0 },    // Cool-down
        //     ],
        //     exec: 'scenarioLifecycle',
        // },

        // // [시나리오 2] 악성 유저: 5명이서 미친듯이 사이클을 돌림 (Thinking Time 없음)
        // // *참고: SSE 연결/해제 비용까지 서버에 부하를 줌
        // abusers: {
        //     executor: 'constant-vus',
        //     vus: 5,
        //     duration: '5m',
        //     exec: 'scenarioAbuser',
        // },
    },
};

const params = {
    headers: { 'Content-Type': 'application/json' },
};

// -----------------------------------------------------------------------
// [핵심 로직] 유저 라이프사이클 (Connect -> Post -> Done -> Close)
// -----------------------------------------------------------------------
export function scenarioLifecycle() {
    const sessionId = `session-${randomString(10)}`;
    // const uuid = uuidv4();

    const url = `${BASE_URL}/api/v1/chat/stream/${sessionId}`;
    const params = {
        method: 'GET',
        tags: {
            "scenario": "normal_users"
        }
    }

    let myUuid = null;
    let isChatSent = false;


    const response = sse.open(url, params, function (client) {
        client.on('on', function open() {
            console.log('connected')
        })

        client.on('message', function (eventData) {

            if (!eventData.data || eventData.data === "") {
                console.log('Skipping empty heartbeat/ping...');
                return;
            }


            const data = JSON.parse(eventData.data);
            console.log(`get Data : ${data}`)

            myUuid = data.uuid;

            if (data.type === 'init' && data.uuid) {

                if (!isChatSent) {
                    const payload = JSON.stringify({
                        sessionId: sessionId,
                        uuid: myUuid,
                        mode: 'test',
                        content: `Lifecycle Test Message ${randomString(10)}`,
                        context: null,
                    });

                    http.post(`${BASE_URL}/api/v1/chat/message`, payload, params);
                    isChatSent = true;
                }
            }

            if (data.type === 'done') {
                console.log('An unexpected error occurred: ', error)
            }
        })

        client.on('error', function (error) {
            console.log(error)
        })
    })

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