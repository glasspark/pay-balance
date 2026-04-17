import {useState} from 'react'
import './App.css'
import closeIcon from './assets/close.svg'
import addIcon from './assets/add.svg'
import removeIcon from './assets/remove.svg'
import refreshIcon from './assets/refresh.svg'
import warningIcon from './assets/warning_amber.svg'
import doneIcon from './assets/done.svg'


const presetAmounts = [10, 50, 100, 500, 1000, 5000, 10000, 50000]
const maxLength = 10;
const MAX_AMOUNT = 100_000_000

const settlementTypeCards = [
    {
        title: '균등 정산',
        description: '총금액을 참여자 수만큼 똑같이 나눕니다.',
    },
    {
        title: '차액 정산',
        description: '각자 낸 금액을 비교해 누가 누구에게 얼마를 보내야 하는지 계산합니다.',
    },
    {
        title: '항목별 정산',
        description: '술값, 안주값, 택시비처럼 항목별로 나눠 정산합니다.',
    },
    {
        title: '제외 정산',
        description: '특정 항목에서 빠지는 사람을 제외하고 계산합니다.',
    },
    {
        title: '비율 정산',
        description: '사람마다 다른 비율로 부담 금액을 계산합니다.',
    },
]

type ParticipantInput = {
    id: string
    name: string
}

type Participant = {
    id: string
    name: string
    expenseAmount: string   // 일단 input 제어용 string
    expenseSource: string   // 어디서 사용했는지
}

type ExpenseItem = {
    id: string
    participantId: string
    participantName: string
    source: string
    amount: number
}

type Settlement = { from: string; to: string; amount: number }


function App() {

    // 첫 렌더부터 입력창이 2개
    // Step1에서 사용자가 직접 입력 중인 참여자 이름 입력창 상태
    const [participantInputs, setParticipantInputs] = useState<ParticipantInput[]>([
        {id: crypto.randomUUID(), name: ''},
        {id: crypto.randomUUID(), name: ''},
    ])
    // Step1 입력 완료 후 Step2/Step3에서 사용할 확정 참여자 데이터
    const [participants, setParticipants] = useState<Participant[]>([])

    // 입력 검증 실패 메시지(예: 최소 인원 미달, 빈 이름)
    const [inputError, setInputError] = useState('')

    // 현재 화면 단계(1: 참여자 입력, 2: 정산금액 입력, 3: 정산 결과)
    const [currentStep, setCurrentStep] = useState(1)

    // Step2에서 상세 입력 패널이 열려 있는 참여자 id 목록(다중 토글용)
    const [openParticipantIds, setOpenParticipantIds] = useState<string[]>([])

    // 정산금 내역 리스트
    const [expenseList, setExpenseList] = useState<ExpenseItem[]>([])

    // 등록 시 숫자 파싱 (쉼표 제거 후 반환)
    const handleRegisterExpense = (participant: Participant) => {
        const source = participant.expenseSource.trim()
        const amount = Number(participant.expenseAmount.replace(/,/g, ''))

        if (!source || !Number.isFinite(amount) || amount <= 0) return

        setExpenseList((prev) => [
            ...prev,
            {
                id: crypto.randomUUID(),
                participantId: participant.id,
                participantName: participant.name,
                source,
                amount,
            },
        ])

        // 등록 후 해당 입력값 초기화
        setParticipants((prev) =>
            prev.map((p) =>
                p.id === participant.id ? {...p, expenseSource: '', expenseAmount: ''} : p
            )
        )
    }

    // 각 정산금액 리스트의 항목을 개별 삭제
    const deleteExpense = (participantId: string, expenseId: string) => {
        setExpenseList((prev) =>
            prev.filter(
                (item) => !(item.participantId === participantId && item.id === expenseId)
            )
        )
    }

    //  금액 입력 핸들러
    const handleAmountChange = (id: string, rawValue: string) => {
        const onlyDigits = rawValue.replace(/[^\d]/g, '')
        if (!onlyDigits) {
            setParticipants((prev) =>
                prev.map((p) => (p.id === id ? {...p, expenseAmount: ''} : p)),
            )
            return
        }

        const numeric = Math.min(Number(onlyDigits), MAX_AMOUNT)
        const formatted = numeric.toLocaleString('ko-KR')

        setParticipants((prev) =>
            prev.map((p) => (p.id === id ? {...p, expenseAmount: formatted} : p)),
        )
    }

    const handleSourceChange = (id: string, value: string) => {
        setParticipants(prev => prev.map(p => p.id === id ? {...p, expenseSource: value} : p))
    }

    const toggleParticipantDetail = (id: string) => {
        setOpenParticipantIds((prev) =>
            prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
        )
    }

    const formatAmount = (amount: number) => {
        return amount.toLocaleString('ko-KR')
    }

    // 각 개인별 금액의 총 합을 구한다.
    const getParticipantTotal = (participantId: string) => {
        return expenseList
            .filter((item) => item.participantId === participantId)
            .reduce((sum, item) => sum + item.amount, 0)
    }

    // Step3 정산 결과 계산:
    // 1) 개인별 지출 합산 -> 2) 1인당 부담액 계산 -> 3) 송금 매칭 목록 생성
    const buildSettlements = (): Settlement[] => {
        if (participants.length === 0) return []

        // participantId 기준으로 실제 지출 총액을 누적한다.
        const spentByParticipantId = expenseList.reduce<Record<string, number>>((acc, item) => {
            acc[item.participantId] = (acc[item.participantId] ?? 0) + item.amount
            return acc
        }, {})

        // 전체 지출과 1인당 목표 부담액을 계산한다.
        const totalSpent = participants.reduce(
            (sum, participant) => sum + (spentByParticipantId[participant.id] ?? 0),
            0,
        )
        const targetPerPerson = totalSpent / participants.length

        // 더 낸 사람(받을 사람) 목록
        const creditors = participants
            .map((participant) => ({
                name: participant.name,
                amount: (spentByParticipantId[participant.id] ?? 0) - targetPerPerson,
            }))
            .filter((item) => item.amount > 0)

        // 덜 낸 사람(보낼 사람) 목록
        const debtors = participants
            .map((participant) => ({
                name: participant.name,
                amount: targetPerPerson - (spentByParticipantId[participant.id] ?? 0),
            }))
            .filter((item) => item.amount > 0)

        // 채무자/채권자를 순서대로 매칭해 최소 송금 횟수에 가깝게 정산 목록을 만든다.
        const settlements: Settlement[] = []
        let debtorIndex = 0
        let creditorIndex = 0

        while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
            const transferAmount = Math.min(
                debtors[debtorIndex].amount,
                creditors[creditorIndex].amount,
            )

            if (transferAmount <= 0) break

            settlements.push({
                from: debtors[debtorIndex].name,
                to: creditors[creditorIndex].name,
                amount: transferAmount,
            })

            debtors[debtorIndex].amount -= transferAmount
            creditors[creditorIndex].amount -= transferAmount

            if (debtors[debtorIndex].amount <= 0) debtorIndex += 1
            if (creditors[creditorIndex].amount <= 0) creditorIndex += 1
        }

        return settlements
    }
    // 프리셋 더하기도 쉼표 문자열 기준으로 파싱
    const handlePresetAmountClick = (id: string, addAmount: number) => {
        setParticipants((prev) =>
            prev.map((p) => {
                if (p.id !== id) return p
                const current = Number((p.expenseAmount || '').replace(/,/g, '')) || 0
                const next = Math.min(current + addAmount, MAX_AMOUNT)
                return {...p, expenseAmount: next.toLocaleString('ko-KR')}
            }),
        )
    }

    const addParticipant = () => {
        if (participantInputs.length >= 20) {
            return;
        }

        setParticipantInputs((prev) => [
            ...prev,
            {id: crypto.randomUUID(), name: ''},
        ])
    }
    const handleRemoveParticipant = (id: string) => {
        if (participantInputs.length <= 2) {
            return;
        }
        setParticipantInputs((prev) => prev.filter((item) => item.id !== id))
    }

    const handleNameChange = (id: string, value: string) => {
        setParticipantInputs((prev) =>
            prev.map((item) => (item.id === id ? {...item, name: value} : item)),
        )
    }

    const handleReset = () => {
        setParticipantInputs([
            {id: crypto.randomUUID(), name: ''},
            {id: crypto.randomUUID(), name: ''},
        ])
        setInputError('')
    }

    const validParticipantCount = participantInputs.filter(
        (item) => item.name.trim().length > 0,
    ).length
    const canProceedStep1 = validParticipantCount >= 2
    const canProceedStep2 = expenseList.length > 0

    const goToStep2 = () => {
        if (!canProceedStep1) {
            setInputError('최소 2명의 참여자 이름을 입력해주세요.')
            return
        }

        const normalizedParticipants = participantInputs
            .map((item) => ({
                id: item.id,
                name: item.name.trim(),
                expenseAmount: '',
                expenseSource: '',
            }))
            .filter((item) => item.name.length > 0)

        if (normalizedParticipants.length <= 1) {
            setInputError('최소 2명의 참여자 이름을 입력해주세요.')
            return
        }

        setParticipants(normalizedParticipants)
        setInputError('')
        setCurrentStep(2)
    }

    const goToStep3 = () => {
        if (!canProceedStep2) return
        setCurrentStep(3)
    }

    const settlements = buildSettlements()
    const totalSpent = expenseList.reduce((sum, item) => sum + item.amount, 0)
    const perPerson = participants.length > 0 ? totalSpent / participants.length : 0

    const startNewCalculation = () => {
        setParticipantInputs([
            {id: crypto.randomUUID(), name: ''},
            {id: crypto.randomUUID(), name: ''},
        ])
        setParticipants([])
        setExpenseList([])
        setOpenParticipantIds([])
        setInputError('')
        setCurrentStep(1)
    }

    const shareTemporarily = () => {
        window.alert('공유 기능은 준비 중입니다.')
    }

    return (
        <main className="page">
            <header className="page-header">
                <h1>PayBalance</h1>
            </header>

            <section className="hero-section">
                <h1 className="step-kicker">PayBalance</h1>
                <h2 className="step-title">모임 정산이 늘 헷갈리셨나요?</h2>
                <p className="step-description">
                    누군가는 더 냈고, 누군가는 덜 냈지만 계산은 늘 복잡합니다.
                    <br/>
                    각자 결제한 금액을 입력하면 총 지출 금액, 1인당 부담 금액, 최종 송금 관계를 한 번에 해결!
                </p>
            </section>

            <section className="settlement-type-section">
                <div className="settlement-type-grid">
                    {settlementTypeCards.map((card, index) => (
                        <article className="settlement-type-card" key={`feature-${index}`}>
                            <strong className="settlement-type-title">{card.title}</strong>
                            <p className="settlement-type-description">{card.description}</p>
                        </article>
                    ))}
                </div>
            </section>


            <section className="step-content">
                <ol className="step1-progress" aria-label="진행 단계">
                    <li className={currentStep === 1 ? 'step1-progress-item is-current' : currentStep > 1 ? 'step1-progress-item is-done' : 'step1-progress-item'}>
                        <span className="step1-progress-badge">
                            {currentStep > 1 ? <img src={doneIcon} alt="완료"/> : '1'}
                        </span>
                        <span>정산멤버 추가</span>
                    </li>
                    <li className={currentStep === 2 ? 'step1-progress-item is-current' : currentStep > 2 ? 'step1-progress-item is-done' : 'step1-progress-item'}>
                        <span className="step1-progress-badge">
                            {currentStep > 2 ? <img src={doneIcon} alt="완료"/> : '2'}
                        </span>
                        <span>정산금액 입력</span>
                    </li>
                    <li className={currentStep === 3 ? 'step1-progress-item is-current' : 'step1-progress-item'}>
                        <span className="step1-progress-badge">3</span>
                        <span>정산결과</span>
                    </li>
                </ol>

                {currentStep === 1 ? (
                    <>
                        <article className="step-card">
                            <div className="step1-divider"/>

                            <section className="step1-notice" aria-label="정산 안내">
                                <div className="step1-notice-left">
                                    <div className="step1-notice-title-row">
                                        <img src={warningIcon} alt=""/>
                                        <p>균등 정산은 균등 분할(1/N) 기반 정산입니다.</p>
                                    </div>
                                    <p className="step1-notice-description"> - 정산 멤버는 최소 2인에서 최대 20명 까지 가능합니다.</p>
                                </div>
                            </section>

                            {participantInputs.map((item, index) => (
                                <div className="input-row participant-input-row" key={item.id}>
                                    <input
                                        id={`participant-${item.id}`}
                                        type="text"
                                        placeholder="정산 멤버 이름"
                                        value={item.name}
                                        onChange={(event) => handleNameChange(item.id, event.target.value)}
                                        maxLength={maxLength}
                                    />

                                    <button
                                        type="button"
                                        onClick={() => handleRemoveParticipant(item.id)}
                                        aria-label={`참여자 ${index + 1} 삭제`}
                                        className="participant-remove-button"
                                        disabled={participantInputs.length <= 2}>
                                        <img src={closeIcon} alt=""/>
                                    </button>

                                </div>
                            ))}

                            {inputError ? (
                                <p className="error-message" role="alert">
                                    {inputError}
                                </p>
                            ) : null}

                            <div className="action-row">
                                <button type="button" className="btn step1-add-member-button" onClick={addParticipant}>
                                    + 정산 멤버 추가
                                </button>
                            </div>
                        </article>

                        <div className="step1-bottom-actions">
                            <button type="button" className="btn btn-secondary reset-action-button"
                                    onClick={handleReset}>
                                <img src={refreshIcon} alt=""/> 초기화
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={goToStep2}
                                disabled={!canProceedStep1}
                            >
                                다음
                            </button>
                        </div>
                    </>
                ) : null}

                {currentStep === 2 ? (
                    <>
                        <article className="step-card">
                            <h2>정산금액 입력</h2>
                            <ul className="participant-expense-list">
                                {participants.map((participant) => {
                                    const isOpen = openParticipantIds.includes(participant.id)
                                    return (
                                        <li key={participant.id} className="participant-item">
                                            <div className="participant-summary-row">
                                                <span>{participant.name}</span>
                                                <div className="participant-summary-actions">
                                                    <span>{getParticipantTotal(participant.id).toLocaleString()}원</span>
                                                    <button
                                                        type="button"
                                                        className={`participant-toggle-button ${isOpen ? 'open' : ''}`}
                                                        onClick={() => toggleParticipantDetail(participant.id)}
                                                        aria-expanded={isOpen}
                                                        aria-controls={`detail-${participant.id}`}>
                                                        <img src={isOpen ? removeIcon : addIcon} alt=""/>
                                                    </button>
                                                </div>
                                            </div>
                                            <ul className="expense-history-list">
                                                {expenseList.filter((item) => item.participantId === participant.id).map((item) => (
                                                    <li key={`${item.participantId}-${item.id}`}
                                                        className="expense-item">
                                                        <span className="expense-source">{item.source}</span>
                                                        <div className="expense-item-actions">
                                                        <span
                                                            className="expense-amount">{item.amount.toLocaleString()}원</span>
                                                            <button
                                                                type="button"
                                                                className="expense-delete-button"
                                                                onClick={() => deleteExpense(item.participantId, item.id)}
                                                            >
                                                                <img src={closeIcon} alt=""/>
                                                            </button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                            {isOpen ? (
                                                <div id={`detail-${participant.id}`}
                                                     className="participant-detail-panel">

                                                    <div className="input-row">
                                                        <label htmlFor={`source-${participant.id}`}>사용처</label>
                                                        <input
                                                            id={`source-${participant.id}`}
                                                            type="text"
                                                            placeholder="예: 점심, 카페"
                                                            value={participant.expenseSource}
                                                            maxLength={20}
                                                            onChange={(e) =>
                                                                handleSourceChange(participant.id, e.target.value)
                                                            }
                                                        />
                                                    </div>

                                                    <div className="input-row">
                                                        <label htmlFor={`amount-${participant.id}`}>금액</label>
                                                        <input
                                                            id={`amount-${participant.id}`}
                                                            type="text"
                                                            inputMode="numeric"
                                                            placeholder="예: 12,000"
                                                            maxLength={12}
                                                            value={participant.expenseAmount}
                                                            onChange={(e) => handleAmountChange(participant.id, e.target.value)}
                                                        />
                                                        <div className="amount-preset-list">
                                                            {presetAmounts.map((amount) => (
                                                                <button
                                                                    key={amount}
                                                                    type="button"
                                                                    className="btn amount-preset-button"
                                                                    onClick={() => handlePresetAmountClick(participant.id, amount)}
                                                                >
                                                                    {formatAmount(amount)}
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <button className="btn expense-submit-button"
                                                                onClick={() => handleRegisterExpense(participant)}> 등록
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : null}
                                        </li>
                                    )
                                })}
                            </ul>

                        </article>

                        <div className="step2-bottom-actions">
                            <button type="button" className="btn btn-secondary back-button"
                                    onClick={() => setCurrentStep(1)}>
                                이전
                            </button>
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={goToStep3}
                                disabled={!canProceedStep2}>
                                다음
                            </button>
                        </div>
                    </>
                ) : null}

                {currentStep === 3 ? (
                    <>
                        <article className="step-card">
                            <h2>최종 정산 결과</h2>
                            <section className="receipt" aria-label="정산 영수증">
                                <div className="receipt-header">
                                    <p className="receipt-title">PAY BALANCE RECEIPT</p>
                                    <p className="receipt-subtitle">정산 결과 영수증</p>
                                </div>
                                <div className="receipt-meta">
                                    <p>
                                        <span>참여 인원</span>
                                        <strong>{participants.length}명</strong>
                                    </p>
                                    <p>
                                        <span>총 지출 금액</span>
                                        <strong>{formatAmount(totalSpent)}원</strong>
                                    </p>
                                    <p>
                                        <span>1인당 부담 금액</span>
                                        <strong>{formatAmount(Math.round(perPerson))}원</strong>
                                    </p>
                                </div>

                                {settlements.length === 0 ? (
                                    <p className="empty-message">정산 결과를 계산할 데이터가 부족합니다.</p>
                                ) : (
                                    <div className="receipt-transfer-list">
                                        <div className="receipt-transfer-head">
                                            <span>보내는 사람</span>
                                            <span>받는 사람</span>
                                            <span>송금 금액</span>
                                        </div>
                                        {settlements.map((settlement, index) => (
                                            <div
                                                key={`${settlement.from}-${settlement.to}-${index}`}
                                                className="receipt-transfer-row"
                                            >
                                                <span>{settlement.from}</span>
                                                <span>{settlement.to}</span>
                                                <span>{formatAmount(Math.round(settlement.amount))}원</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>

                        </article>

                        <div className="step3-bottom-actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setCurrentStep(2)}>
                                이전
                            </button>
                            <button type="button" className="btn btn-secondary" onClick={shareTemporarily}>
                                공유하기 (임시)
                            </button>
                            <button type="button" className="btn" onClick={startNewCalculation}>
                                새로운 계산
                            </button>
                        </div>
                    </>
                ) : null}
            </section>
        </main>
    )
}

export default App
