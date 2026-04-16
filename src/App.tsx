import {useState} from 'react'
import './App.css'
import closeIcon from './assets/close.svg'
import downIcon from './assets/keyboard_arrow_down.svg'

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

function App() {
    const [currentStep, setCurrentStep] = useState(1)

    const [openParticipantIds, setOpenParticipantIds] = useState<string[]>([])


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

    // 첫 렌더부터 입력창이 2개
    const [participantInputs, setParticipantInputs] = useState<ParticipantInput[]>([
        {id: crypto.randomUUID(), name: ''},
        {id: crypto.randomUUID(), name: ''},
    ])
    const [participants, setParticipants] = useState<Participant[]>([])
    const [inputError, setInputError] = useState('')

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

    return (
        <main className="page">
            <header className="page-header">
                <h1>PayBalance</h1>
                <p>회원가입처럼 단계별로 정산을 진행합니다.</p>
            </header>

            <section className="step-bar" aria-label="진행 단계">
        <span className={currentStep === 1 ? 'step-badge active' : 'step-badge'}>
          Step 1 참여자 입력
        </span>
                <span className={currentStep === 2 ? 'step-badge active' : 'step-badge'}>
          Step 2 정산금액 입력
        </span>
                <span className={currentStep === 3 ? 'step-badge active' : 'step-badge'}>
          Step 3 정산 결과
        </span>
            </section>

            <section className="step-panel">
                {currentStep === 1 ? (
                    <article className="card">
                        <h2>참여자 입력</h2>

                        {participantInputs.map((item, index) => (
                            <div className="input-row participant-row" key={item.id}>
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
                                    className="remove-button"
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

                        <div className="button-row">
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
                    <article className="card">
                        <h2>정산금액 입력</h2>
                        <ul className="list">
                            {participants.map((participant) => {
                                const isOpen = openParticipantIds.includes(participant.id)
                                return (
                                    <li key={participant.id} className="participant-item">
                                        <div className="participant-row">
                                            <span>{participant.name}</span>

                                            <button
                                                type="button"
                                                className={`toggle-btn ${isOpen ? 'open' : ''}`}
                                                onClick={() => toggleParticipantDetail(participant.id)}
                                                aria-expanded={isOpen}
                                                aria-controls={`detail-${participant.id}`}
                                            >
                                                <img src={downIcon} alt=""/>
                                            </button>
                                        </div>

                                        {isOpen ? (
                                            <div id={`detail-${participant.id}`} className="participant-detail">

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
                                                </div>

                                            </div>
                                        ) : null}
                                    </li>
                                )
                            })}
                        </ul>


                        <div className="button-row">
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
                    <article className="card">
                        <h2>최종 정산 결과</h2>
                        <ul className="result-list">
                            <li>현우가 지연에게 4,000원 송금</li>
                            <li>민수가 지연에게 1,000원 송금</li>
                            <li>정산 완료 후 모두 13,000원씩 부담</li>
                        </ul>

                        <div className="button-row">
                            <button type="button" className="secondary" onClick={() => setCurrentStep(2)}>
                                이전
                            </button>
                        </div>
                    </article>
                ) : null}
            </section>
        </main>
    )
}

export default App
