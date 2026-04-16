import {useState} from 'react'
import './App.css'
import closeIcon from './assets/close.svg'
import addIcon from './assets/add.svg'
import removeIcon from './assets/remove.svg'

const presetAmounts = [10, 50, 100, 500, 1000, 5000, 10000, 50000]

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


    // 등록 버튼을 누르면 해당 id의 요소에 list가 추가된다.
    const handleRegisterExpense = (participant: Participant) => {
        const source = participant.expenseSource.trim()
        const amount = Number(participant.expenseAmount)

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

        // 선택: 등록 후 해당 입력값 초기화
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


    const handleAmountChange = (id: string, value: string) => {
        setParticipants(prev => prev.map(p => p.id === id ? {...p, expenseAmount: value} : p))
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

    const handlePresetAmountClick = (id: string, addAmount: number) => {
        setParticipants((prev) =>
            prev.map((p) => {
                if (p.id !== id) return p

                const current = Number(p.expenseAmount) || 0
                return {...p, expenseAmount: String(current + addAmount)}
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

    const goToStep2 = () => {
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
                <p>회원가입처럼 단계별로 정산을 진행합니다.</p>
            </header>

            <section className="step-indicator" aria-label="진행 단계">
        <span className={currentStep === 1 ? 'step-indicator-item is-active' : 'step-indicator-item'}>
          Step 1 참여자 입력
        </span>
                <span className={currentStep === 2 ? 'step-indicator-item is-active' : 'step-indicator-item'}>
          Step 2 정산금액 입력
        </span>
                <span className={currentStep === 3 ? 'step-indicator-item is-active' : 'step-indicator-item'}>
          Step 3 정산 결과
        </span>
            </section>

            <section className="step-content">
                {currentStep === 1 ? (
                    <article className="step-card">
                        <h2>참여자 입력</h2>

                        {participantInputs.map((item, index) => (
                            <div className="input-row participant-input-row" key={item.id}>
                                {/*<label htmlFor={`participant-${item.id}`}>참여자 {index + 1}</label>*/}
                                <input
                                    id={`participant-${item.id}`}
                                    type="text"
                                    placeholder="참여자 이름"
                                    value={item.name}
                                    onChange={(event) => handleNameChange(item.id, event.target.value)}
                                />

                                <button
                                    type="button"
                                    onClick={() => handleRemoveParticipant(item.id)}
                                    aria-label={`참여자 ${index + 1} 삭제`}
                                    className="participant-remove-button"
                                    disabled={participantInputs.length <= 2}
                                >
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
                            <button type="button" onClick={addParticipant}>
                                참여자 입력창 추가
                            </button>
                            <button type="button" className="secondary" onClick={goToStep2}>
                                다음
                            </button>
                        </div>
                    </article>
                ) : null}

                {currentStep === 2 ? (
                    <article className="step-card">
                        <h2>정산금액 입력</h2>
                        <ul className="participant-expense-list">
                            {participants.map((participant) => {
                                const isOpen = openParticipantIds.includes(participant.id)
                                return (
                                    <li key={participant.id} className="participant-item">
                                        <div className="participant-summary-row">
                                            <span>{participant.name}</span>
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
                                        <ul>
                                            {expenseList.filter((item) => item.participantId === participant.id).map((item) => (
                                                <li key={`${item.participantId}-${item.id}`} className="expense-item">
                                                    <p> {item.participantName} | {item.source} | {item.amount.toLocaleString()}원</p>
                                                    <button onClick={() => deleteExpense(item.participantId, item.id)}>
                                                        <img
                                                            src={closeIcon} alt=""/></button>
                                                </li>
                                            ))}
                                        </ul>
                                        {isOpen ? (
                                            <div id={`detail-${participant.id}`} className="participant-detail-panel">

                                                <div className="input-row">
                                                    <label htmlFor={`source-${participant.id}`}>사용처</label>
                                                    <input
                                                        id={`source-${participant.id}`}
                                                        type="text"
                                                        placeholder="예: 점심, 카페"
                                                        value={participant.expenseSource}
                                                        onChange={(e) =>
                                                            handleSourceChange(participant.id, e.target.value)
                                                        }
                                                    />
                                                </div>

                                                <div className="input-row">
                                                    <label htmlFor={`amount-${participant.id}`}>금액</label>
                                                    <input
                                                        id={`amount-${participant.id}`}
                                                        type="number"
                                                        min={0}
                                                        placeholder="예: 12000"
                                                        value={participant.expenseAmount}
                                                        onChange={(e) =>
                                                            handleAmountChange(participant.id, e.target.value)
                                                        }
                                                    />
                                                    <div className="amount-preset-list">
                                                        {presetAmounts.map((amount) => (
                                                            <button
                                                                key={amount}
                                                                type="button"
                                                                onClick={() => handlePresetAmountClick(participant.id, amount)}
                                                            >
                                                                {formatAmount(amount)}
                                                            </button>
                                                        ))}
                                                    </div>
                                                    <button className="expense-submit-button"
                                                            onClick={() => handleRegisterExpense(participant)}> 등록
                                                    </button>
                                                </div>
                                            </div>
                                        ) : null}
                                    </li>
                                )
                            })}
                        </ul>


                        <div className="action-row">
                            <button type="button" className="secondary" onClick={() => setCurrentStep(1)}>
                                이전
                            </button>
                            <button type="button" onClick={() => setCurrentStep(3)}>
                                다음
                            </button>
                        </div>
                    </article>
                ) : null}

                {currentStep === 3 ? (
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
                                <ul className="result-list receipt-list">
                                    {settlements.map((settlement, index) => (
                                        <li key={`${settlement.from}-${settlement.to}-${index}`}>
                                            {settlement.from}가 {settlement.to}에게 {formatAmount(Math.round(settlement.amount))}
                                            원 송금
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <div className="action-row">
                            <button type="button" className="secondary" onClick={() => setCurrentStep(2)}>
                                이전
                            </button>
                            <button type="button" className="secondary" onClick={shareTemporarily}>
                                공유하기 (임시)
                            </button>
                            <button type="button" onClick={startNewCalculation}>
                                새로운 계산
                            </button>
                        </div>
                    </article>
                ) : null}
            </section>
        </main>
    )
}

export default App
