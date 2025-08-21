import React, { useState, useEffect } from 'react'
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, Cog6ToothIcon, SparklesIcon } from '@heroicons/react/24/outline'
import Settings from './Settings'
import { APIManager } from '../config/api'

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const Popup: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [hasConfig, setHasConfig] = useState(false)

  useEffect(() => {
    checkConfig()
  }, [])

  const checkConfig = async () => {
    try {
      const config = await APIManager.getInstance().getConfig()
      setHasConfig(!!config)
    } catch (error) {
      console.error('检查配置失败:', error)
    }
  }

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      // 这里调用你的AI API
      const response = await callAIAPI(inputValue)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('API调用失败:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const callAIAPI = async (prompt: string): Promise<string> => {
    try {
      return await APIManager.getInstance().callAPI(prompt)
    } catch (error) {
      throw new Error(`API调用失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const insertToPage = (text: string) => {
    // 向content script发送消息，插入SQL到页面
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'insertSQL',
          sql: text
        })
      }
    })
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header with gradient */}
      <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative flex items-center justify-between p-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <SparklesIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold">SQL Copilot</h1>
              <p className="text-xs text-blue-100">AI驱动的SQL助手</p>
            </div>
          </div>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm"
          >
            <Cog6ToothIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} onConfigSaved={() => setHasConfig(true)} />

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-4 bg-white/80 backdrop-blur-sm border-b border-gray-200/50">
          <h3 className="text-sm font-medium text-gray-900 mb-3">API设置</h3>
          {!hasConfig ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-600 mb-3">请先配置API设置</p>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 text-sm font-medium shadow-md transition-all duration-200 transform hover:scale-105"
              >
                配置API
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-8 h-8 bg-green-100 rounded-full mb-3">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
              </div>
              <p className="text-sm text-green-700 mb-3 font-medium">✓ API已配置</p>
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-all duration-200"
              >
                修改配置
              </button>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-12">
            <div className="relative mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="w-10 h-10 text-blue-500" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                <SparklesIcon className="w-3 h-3 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">开始你的SQL之旅</h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">描述你需要的SQL查询，AI将为你生成相应的代码</p>
          </div>
        ) : (
          messages.map(message => (
            <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm ${
                  message.type === 'user'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white'
                    : 'bg-white/80 backdrop-blur-sm text-gray-900 border border-gray-200/50 shadow-md'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
                {message.type === 'assistant' && (
                  <div className="flex space-x-3 mt-3 pt-3 border-t border-gray-100">
                    <button
                      onClick={() => copyToClipboard(message.content)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors duration-200"
                    >
                      复制
                    </button>
                    <button
                      onClick={() => insertToPage(message.content)}
                      className="text-xs text-green-600 hover:text-green-800 font-medium hover:bg-green-50 px-2 py-1 rounded-lg transition-colors duration-200"
                    >
                      插入到页面
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/80 backdrop-blur-sm text-gray-900 border border-gray-200/50 px-4 py-3 rounded-2xl shadow-md">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.1s' }}
                ></div>
                <div
                  className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                  style={{ animationDelay: '0.2s' }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input with glassmorphism */}
      <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-200/50">
        <div className="flex space-x-3">
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="描述你需要的SQL查询..."
            className="flex-1 p-3 border border-gray-300/50 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent bg-white/50 backdrop-blur-sm shadow-sm transition-all duration-200"
            rows={2}
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-md transition-all duration-200 transform hover:scale-105 disabled:transform-none"
          >
            <PaperAirplaneIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default Popup
