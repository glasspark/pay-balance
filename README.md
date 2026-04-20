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

### STEP1 참여자 동적 추가/삭제 (최소 2명 기준)
<img width="1221" height="960" alt="image" src="https://github.com/user-attachments/assets/2a9f5202-51e2-448f-9cd4-6a260411287f" />  

참여자는 기본 2명이며 최대 20명까지 등록이 가능합니다.  

### STEP2 사람별 지출 등록 (사용처 + 금액)   
<img width="1184" height="1087" alt="image" src="https://github.com/user-attachments/assets/99de8502-2d9f-4003-b717-2fb22f4f4d74" /> 

STEP2에서는 STEP1에서 등록한 사람들의 목록이 표시되며, 각 사람 오른쪽의 + 아이콘을 누르면 해당 인원의 지출 금액을 입력할 수 있는 창이 나타납니다.
 
<img width="1176" height="767" alt="image" src="https://github.com/user-attachments/assets/d917e84b-4188-4743-ae4e-ea6025c5d9b9" />  

### STEP2-1 항목별 분배 편집
   #### 제외
   제외 체크박스를 클릭하면 해당 참여자는 이번 결제에서 제외가 됩니다. 
   <img width="1121" height="318" alt="image" src="https://github.com/user-attachments/assets/c95500b0-32bf-4319-8ab9-81d54a94e63f" />
   #### 고정 금액
   고정 금액을 설정하면 해당 고정 금액을 제외한 나머지 금액으로 계산이 진행됩니다.
   <img width="1120" height="314" alt="image" src="https://github.com/user-attachments/assets/cb1f37c6-d7dc-4549-bc4b-61f2ab8a0359" />
   #### 비율
   비율은 기본 1:1 이며 참여자별 숫자 비중으로 잔액을 나눕니다. 고정금액이 있으면 먼저 반영한 뒤, 남은 금액에 비율을 적용합니다. 0 또는 빈 값은 기본값 1로 처리됩니다.
   <img width="1124" height="312" alt="image" src="https://github.com/user-attachments/assets/a56f5c5c-6c57-4807-bac1-765f8d4458ff" />


### STEP3 최종 정산 송금 관계 자동 계산
<img width="1204" height="1079" alt="image" src="https://github.com/user-attachments/assets/70ff3297-8ff1-48e2-a0f5-45b356b6871e" />  
Step3 결과 화면은 영수증 형태로 구성되어, 먼저 참여 인원과 총 지출 금액을 상단에서 요약해 보여줍니다.<br />
그 아래에는 각 참여자의 실제 결제액, 최종 부담액, 차액(플러스/마이너스)을 표로 정리해 개인별 정산 상태를 한눈에 확인할 수 있습니다.<br /><br />
이어서 결제자 기준의 지출 항목(사용처·금액)과 사람별 지출 합계를 함께 보여주고, 항목별 분배 규칙(제외 대상, 고정금액, 비율)도 별도 요약 표로 제공합니다.
최종 송금 결과를 보내는 사람/받는 사람/송금 금액 3열 구조로 표시합니다.

<img width="1202" height="987" alt="image" src="https://github.com/user-attachments/assets/862d3de3-6142-48bf-a852-e1aa3ae258cd" />
우측 상단의 ? 아이콘의 도움말 버튼을 통해 계산 로직과 중간 계산식(합계, 차액)까지 확인할 수 있습니다.

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
- 배포 주소: ~~https://glasspark.github.io/pay-balance/~~ [현재 비활성화]

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

