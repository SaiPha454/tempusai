import React, { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, User, Timer } from 'lucide-react';
import { ChatMessage } from '../types';
import { SUGGESTIONS } from '../constants';
import { streamGeminiResponse } from '../services/geminiService';

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (text: string = input) => {
    if (!text.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      text: text,
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsStreaming(true);

    const aiMsgId = (Date.now() + 1).toString();
    const aiMsgPlaceholder: ChatMessage = {
      id: aiMsgId,
      role: 'model',
      text: '',
      isTyping: true
    };
    
    setMessages(prev => [...prev, aiMsgPlaceholder]);

    // Prepare history for API
    const history = messages.map(m => ({
      role: m.role,
      parts: [{ text: m.text }]
    }));

    let fullResponse = "";

    await streamGeminiResponse(text, history, (chunk) => {
      fullResponse += chunk;
      setMessages(prev => prev.map(msg => 
        msg.id === aiMsgId 
          ? { ...msg, text: fullResponse, isTyping: false } 
          : msg
      ));
    });

    setIsStreaming(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg relative overflow-hidden">
      {/* Background Grid Effect */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'radial-gradient(#252b3b 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
      </div>

      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 z-10 animate-fade-in-up">
          <h1 className="font-serif text-4xl md:text-5xl text-gray-200 mb-4 text-center">
            Hello, Dr. Chandra.<br />
            <span className="italic text-gold">How can I help you today?</span>
          </h1>
          <p className="text-gray-500 max-w-lg text-center mb-8">
            Ask me anything about schedules, room availability, professor assignments, exam conflicts, or campus events.
          </p>
          <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSend(s)}
                className="px-4 py-2 rounded-full border border-border bg-surface hover:bg-gold/10 hover:border-gold/40 hover:text-gold text-sm text-gray-400 transition-all duration-200"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 z-10 custom-scrollbar">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-fade-in`}>
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user' 
                  ? 'bg-gradient-to-br from-accent to-blue-700 text-white' 
                  : 'bg-gradient-to-br from-gold to-gold-dim text-bg shadow-[0_0_10px_rgba(201,168,76,0.3)]'
              }`}>
                {msg.role === 'user' ? <User size={16} /> : <Timer size={18} />}
              </div>
              
              <div className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent/20 border border-accent/30 text-blue-100 rounded-tr-sm'
                  : 'bg-surface border border-border text-gray-200 rounded-tl-sm shadow-lg'
              }`}>
                {msg.isTyping && !msg.text ? (
                   <div className="flex gap-1 h-5 items-center px-1">
                     <span className="w-1.5 h-1.5 bg-gold/70 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                     <span className="w-1.5 h-1.5 bg-gold/70 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                     <span className="w-1.5 h-1.5 bg-gold/70 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                   </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: msg.text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-gold font-medium">$1</strong>').replace(/\n/g, '<br/>') }} />
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 md:p-6 bg-surface/80 backdrop-blur-md border-t border-border z-20">
        <div className="max-w-4xl mx-auto relative flex items-end gap-3 p-2 bg-surface2 border border-border rounded-xl focus-within:ring-2 focus-within:ring-gold/20 focus-within:border-gold/40 transition-all duration-200">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about schedules, rooms, or professors..."
            className="w-full bg-transparent border-none focus:ring-0 text-sm text-gray-200 placeholder-gray-500 resize-none py-2 px-2 max-h-32 min-h-[44px]"
            rows={1}
            style={{ minHeight: '44px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isStreaming}
            className="p-2.5 rounded-lg bg-gradient-to-br from-gold to-gold-dim text-bg hover:shadow-[0_0_15px_rgba(201,168,76,0.4)] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
          >
            {isStreaming ? <Sparkles size={18} className="animate-pulse" /> : <Send size={18} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-gray-600 mt-2">AI can make mistakes. Please verify scheduling data.</p>
      </div>
    </div>
  );
};

export default ChatInterface;
