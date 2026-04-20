# PayBalance

모임 정산을 빠르게 끝내기 위한 3-Step 정산 웹 앱입니다.  
참여자 등록부터 항목별 지출 입력, 최종 송금 결과(영수증 형태)까지 한 화면 플로우로 제공합니다.

## 프로젝트 개요

- **목표**: 복잡한 모임 정산 과정을 직관적인 단계형 UI로 단순화
- **흐름**
  * Step1: 참여자 추가
  * Step2: 지출 항목 등록 + 항목별 분배 보정
  * Step3: 최종 정산 결과 및 계산 로직 확인

## 주요 기능

#### STEP1 참여자 동적 추가/삭제 (최소 2명 기준)
<img width="1221" height="960" alt="image" src="https://github.com/user-attachments/assets/2a9f5202-51e2-448f-9cd4-6a260411287f" />   

#### STEP2 사람별 지출 등록 (사용처 + 금액)   
<img width="1184" height="1087" alt="image" src="https://github.com/user-attachments/assets/99de8502-2d9f-4003-b717-2fb22f4f4d74" />   

<img width="1176" height="767" alt="image" src="https://github.com/user-attachments/assets/d917e84b-4188-4743-ae4e-ea6025c5d9b9" />
- 항목별 분배 편집
  - 제외
  - <img width="1118" height="312" alt="image" src="https://github.com/user-attachments/assets/aa6881ca-6801-4dbb-9ce2-877c85f859d3" />
  - 고정 금액
  - <img width="1134" height="320" alt="image" src="https://github.com/user-attachments/assets/a26529a8-b0df-4aa3-ae55-097a3f58102b" />
  - 비율
  - <img width="1122" height="324" alt="image" src="https://github.com/user-attachments/assets/14050c5a-6818-48bd-b483-f249ce2fd3f4" />

#### STEP3 최종 정산 송금 관계 자동 계산
<img width="1204" height="1079" alt="image" src="https://github.com/user-attachments/assets/70ff3297-8ff1-48e2-a0f5-45b356b6871e" />
<img width="1202" height="987" alt="image" src="https://github.com/user-attachments/assets/862d3de3-6142-48bf-a852-e1aa3ae258cd" />

- 결과를 영수증(Receipt) UI로 시각화
- 계산 방식 설명 팝오버(`?`) 제공
- 모바일 반응형 대응 (Step UI / 정산 편집 영역 포함)

## 기술 스택

- **Frontend**: React 19, TypeScript
- **Build Tool**: Vite
- **Lint**: ESLint
- **Deployment**: GitHub Pages + GitHub Actions (현재 비활성화)

## 구현 포인트

- 상태 기반 Step 전환 구조 (`currentStep`)
- 항목 단위 분배 데이터 모델링
  - `allocations`
  - `allocationFixedByParticipantId`
  - `allocationRatioByParticipantId`
  - `excludedParticipantIds`
- 분배 검증 및 정산 컨텍스트 생성
  - 개인별 실제 결제 금액
  - 개인별 목표 부담 금액
  - 차액 기반 송금 매칭

## 실행 방법

```bash
npm install
npm run dev
```

## 빌드

```bash
npm run build
```

## 배포

- GitHub Actions 워크플로우: `.github/workflows/deploy.yml`
- Vite base 설정: `base: '/pay-balance/'`
- 배포 주소: [https://glasspark.github.io/pay-balance/](https://glasspark.github.io/pay-balance/) [현재 비활성화]

## 디렉터리 구조

```text
.
├─ src/
│  ├─ App.tsx
│  ├─ App.css
│  └─ assets/
├─ public/
├─ .github/
│  └─ workflows/
│     └─ deploy.yml
└─ vite.config.ts
```

