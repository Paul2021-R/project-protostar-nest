import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { Counter, Trend } from 'k6/metrics';

// -----------------------------------------------------------------------
// 1. 설정 및 메트릭 정의
// -----------------------------------------------------------------------
const BASE_URL = 'http://localhost:5859'; // 혹은 'https://back-protostar.ddns.net'
const TEST_USER = {
  email: 'axel9309@dd.dd', // 실제 DB에 존재하는 테스트 계정 필요
  password: '0314Paul!@'
};

// 메트릭 정의
const uploadDuration = new Trend('upload_duration');
const successRate = new Counter('success_rate');
const failRate = new Counter('fail_rate');
const busyErrorCount = new Counter('busy_error_count'); // 503 Busy 에러 카운트

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'], // 실패율 1% 미만 (503 Busy 제외 시 조정 필요)
    upload_duration: ['p(95)<2000'], // 업로드 95%가 2초 이내
  },
  scenarios: {
    // [시나리오] CRUD 부하 테스트
    crud_test: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: 5 },   // Warm up (5명) -> Busy 안 걸림
        { duration: '20s', target: 15 },  // Load (15명) -> 여기서 503 발생 예상 (Limit 10)
        { duration: '10s', target: 0 },   // Cool down
      ],
      gracefulStop: '10s',
    },
  },
};

// -----------------------------------------------------------------------
// 2. Setup (로그인 및 토큰 발급)
// -----------------------------------------------------------------------
export function setup() {
  const loginRes = http.post(`${BASE_URL}/api/v1/auth/signin`, JSON.stringify(TEST_USER), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status !== 200 && loginRes.status !== 201) {
    console.error(`Login failed: ${loginRes.body}`);
    fail('Login failed - cannot proceed with tests');
  }

  const body = JSON.parse(loginRes.body);
  // 응답 구조에 맞춰 토큰 추출 (예: accessToken 혹은 token)
  return { token: body.accessToken };
}

// -----------------------------------------------------------------------
// 3. Main Logic (VU별 실행)
// -----------------------------------------------------------------------
export default function (data) {
  const token = data.token;
  const authHeaders = {
    Authorization: `Bearer ${token}`,
  };

  // -------------------------
  // A. 파일 업로드 (POST)
  // -------------------------
  // 가상의 파일 생성 (dummy.md)
  const dummyFileContent = 'Fake md Content for Testing purpose...';
  const fileData = http.file(dummyFileContent, 'test_doc.md', 'text/markdown');

  // multipart/form-data payload
  const payload = {
    files: fileData, // Controller에서 @UploadedFiles() files로 받음
  };

  const uploadRes = http.post(`${BASE_URL}/api/v1/upload/knowledge-docs`, payload, {
    headers: authHeaders, // boundary는 k6가 알아서 설정함
  });

  uploadDuration.add(uploadRes.timings.duration);

  // 503 Busy 체크
  if (uploadRes.status === 503) {
    busyErrorCount.add(1);
    console.warn('⚠️ Server is Busy (Expected behavior under load)');
    return; // Busy면 이번 루프 종료
  }

  const isUploadSuccess = check(uploadRes, {
    'Upload status is 201': (r) => r.status === 201,
  });

  if (!isUploadSuccess) {
    failRate.add(1);
    console.error(`Upload failed: ${uploadRes.status} ${uploadRes.body}`);
    return;
  }

  // 업로드된 데이터에서 ID 추출
  const uploadBody = JSON.parse(uploadRes.body);
  console.log(uploadBody);
  // 응답 포맷: { uploaded_data: [ { id: "..." } ], meta: ... }
  const uploadedDocId = uploadBody.uploadedData[0].id;

  // -------------------------
  // B. 목록 조회 (GET)
  // -------------------------
  const listRes = http.get(`${BASE_URL}/api/v1/upload/knowledge-docs`, { headers: authHeaders });
  console.log(listRes.body);
  check(listRes, {
    'List status is 200': (r) => r.status === 200,
    'Uploaded file exists': (r) => r.body.includes(uploadedDocId),
  });

  sleep(1); // 잠시 대기

  // -------------------------
  // C. 파일 교체 (PUT)
  // -------------------------
  const newFileContent = 'Updated Content!!';
  const newFileData = http.file(newFileContent, 'updated_doc.md', 'text/markdown');

  // DTO(id, title)와 파일(file)을 함께 전송
  const replacePayload = {
    id: uploadedDocId,
    title: 'Updated Title via k6',
    file: newFileData, // Controller에서 @UploadedFile() file로 받음
  };

  const replaceRes = http.put(`${BASE_URL}/api/v1/upload/knowledge-docs`, replacePayload, {
    headers: authHeaders,
  });

  if (replaceRes.status === 503) {
    busyErrorCount.add(1);
  } else {
    check(replaceRes, {
      'Replace status is 200 or 201': (r) => r.status === 200 || r.status === 201,
      'Title updated': (r) => r.body.includes('Updated Title via k6'),
    });
  }

  sleep(1);

  // -------------------------
  // D. 파일 삭제 (DELETE)
  // -------------------------
  const deleteRes = http.del(`${BASE_URL}/api/v1/upload/knowledge-docs/${uploadedDocId}`, null, {
    headers: authHeaders,
  });

  check(deleteRes, {
    'Delete status is 200': (r) => r.status === 200,
  });

  if (isUploadSuccess) successRate.add(1);
}