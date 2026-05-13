import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiMapPin, FiSend, FiShield, FiZap } from 'react-icons/fi'
import { AIChatBubble, AISuggestionChip, Button } from '../components/ui'
import '../styles/AssistantPage.css'

const suggestions = [
  'Tình hình giao thông gần tôi thế nào?',
  'Có sự cố hạ tầng nào mới không?',
  'Tôi muốn báo cáo ngập nước',
  'Khu vực này có cảnh báo gì không?',
]

const createAssistantResponse = (question) => ({
  id: `assistant-${Date.now()}`,
  role: 'assistant',
  content:
    'Mình đã ghi nhận câu hỏi và sẵn sàng kết nối RAG backend khi endpoint AI được bật. Hiện tại mình có thể gợi ý mở bảng tin đô thị, xem bản đồ sự cố hoặc tạo báo cáo mới để lấy dữ liệu cộng đồng mới nhất.',
  sources: ['Urban Incident Feed', 'Realtime community reports'],
  actions: [
    { label: 'Xem bảng tin', to: '/urban' },
    { label: 'Mở bản đồ', to: '/urban/map' },
  ],
  relatedIncidents: question.toLowerCase().includes('ngập')
    ? [{ title: 'Theo dõi báo cáo ngập nước', status: 'Mới', location: 'Khu vực gần bạn' }]
    : [],
})

const AssistantPage = () => {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState([])

  const hasMessages = messages.length > 0

  const helperCards = useMemo(() => ([
    { icon: <FiMapPin />, title: 'Dữ liệu đô thị', text: 'Tổng hợp báo cáo giao thông, hạ tầng và môi trường.' },
    { icon: <FiShield />, title: 'Nguồn minh bạch', text: 'Câu trả lời luôn hiển thị nguồn dữ liệu liên quan.' },
    { icon: <FiZap />, title: 'Hành động nhanh', text: 'Mở chi tiết sự cố, bản đồ hoặc form báo cáo ngay từ câu trả lời.' },
  ]), [])

  const askAssistant = async (value = input) => {
    const question = String(value || '').trim()
    if (!question || loading) return

    const userMessage = { id: `user-${Date.now()}`, role: 'user', content: question }
    setMessages((current) => [...current, userMessage])
    setInput('')
    setLoading(true)

    window.setTimeout(() => {
      setMessages((current) => [...current, createAssistantResponse(question)])
      setLoading(false)
    }, 650)
  }

  return (
    <main className="assistant-page">
      <section className="assistant-shell">
        <header className="assistant-header">
          <div>
            <span className="assistant-eyebrow">Smart City Assistant</span>
            <h1>Trợ lý đô thị TixChat</h1>
            <p>Hỏi nhanh về giao thông, hạ tầng, cảnh báo khu vực và dữ liệu sự cố từ cộng đồng.</p>
          </div>
          <div className="assistant-orb" aria-hidden="true">AI</div>
        </header>

        {!hasMessages && (
          <section className="assistant-welcome">
            <div className="assistant-helper-grid">
              {helperCards.map((card) => (
                <article key={card.title} className="assistant-helper-card">
                  <span>{card.icon}</span>
                  <h2>{card.title}</h2>
                  <p>{card.text}</p>
                </article>
              ))}
            </div>

            <div className="assistant-suggestions">
              {suggestions.map((suggestion) => (
                <AISuggestionChip key={suggestion} onClick={() => askAssistant(suggestion)}>
                  {suggestion}
                </AISuggestionChip>
              ))}
            </div>
          </section>
        )}

        {hasMessages && (
          <section className="assistant-thread" aria-live="polite">
            {messages.map((message) => (
              <AIChatBubble key={message.id} role={message.role}>
                <p>{message.content}</p>
                {message.relatedIncidents?.length > 0 && (
                  <div className="assistant-related">
                    {message.relatedIncidents.map((incident) => (
                      <article key={incident.title}>
                        <strong>{incident.title}</strong>
                        <span>{incident.status} · {incident.location}</span>
                      </article>
                    ))}
                  </div>
                )}
                {message.sources?.length > 0 && (
                  <div className="assistant-sources">
                    Nguồn: {message.sources.join(', ')}
                  </div>
                )}
                {message.actions?.length > 0 && (
                  <div className="assistant-actions">
                    {message.actions.map((action) => (
                      <Button key={action.to} as={Link} to={action.to} variant="secondary" size="sm">
                        {action.label}
                      </Button>
                    ))}
                  </div>
                )}
              </AIChatBubble>
            ))}
            {loading && (
              <AIChatBubble>
                <p>Assistant đang phân tích dữ liệu đô thị...</p>
              </AIChatBubble>
            )}
          </section>
        )}

        <form
          className="assistant-composer"
          onSubmit={(event) => {
            event.preventDefault()
            askAssistant()
          }}
        >
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Hỏi về giao thông, hạ tầng hoặc cảnh báo khu vực..."
          />
          <Button type="submit" icon={<FiSend />} disabled={!input.trim() || loading}>
            Gửi
          </Button>
        </form>
      </section>
    </main>
  )
}

export default AssistantPage
