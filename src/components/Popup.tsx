import React, { useState, useEffect } from 'react'
import { ChatBubbleLeftRightIcon, PaperAirplaneIcon, Cog6ToothIcon, SparklesIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline'
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
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null)

  // 保存和恢复对话历史
  useEffect(() => {
    // 从 localStorage 恢复对话历史
    const savedMessages = localStorage.getItem('translationMessages')
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages)
        // 将时间戳转换回 Date 对象
        const messagesWithDates = parsedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }))
        setMessages(messagesWithDates)
      } catch (e) {
        console.error('Failed to parse saved messages', e)
      }
    }
  }, [])

  // 保存对话历史到 localStorage
  useEffect(() => {
    if (messages.length > 0) {
      // 将 Date 对象转换为时间戳进行存储
      const messagesToSave = messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp.getTime()
      }))
      localStorage.setItem('translationMessages', JSON.stringify(messagesToSave))
    }
  }, [messages])

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

  // 显示通知
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({message, type})
    // 3秒后自动隐藏通知
    setTimeout(() => {
      setNotification(null)
    }, 3000)
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
      // 使用流式API调用
      await callAIAPIStream(inputValue)
    } catch (error) {
      console.error('API调用失败:', error)
      // 显示错误消息
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `错误: ${error instanceof Error ? error.message : '未知错误'}`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
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

  // 流式处理API响应
  const callAIAPIStream = async (prompt: string): Promise<string> => {
    const config = await APIManager.getInstance().getConfig()
    if (!config) {
      throw new Error('API配置未设置')
    }

    const provider = config.provider || 'custom'
    
    return new Promise<string>(async (resolve, reject) => {
      try {
        let resultText = ''
        
        // 创建初始的assistant消息
        const initialAssistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          type: 'assistant',
          content: '',
          timestamp: new Date()
        }
        setMessages(prev => [...prev, initialAssistantMessage])

        // 处理流式数据块
        const handleChunk = (chunk: string) => {
          resultText += chunk
          // 更新消息内容
          setMessages(prev => {
            const newMessages = [...prev]
            const lastMessage = newMessages[newMessages.length - 1]
            if (lastMessage && lastMessage.type === 'assistant') {
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                content: resultText
              }
            }
            return newMessages
          })
        }

        // 调用相应的流式API
        await APIManager.getInstance().callAPIStream(prompt, handleChunk)
        resolve(resultText)
      } catch (error) {
        reject(error)
      }
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    showNotification('已复制到剪贴板')
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
    // 立即显示通知，无需等待响应
    showNotification('已插入到页面中')
  }

  // 清除对话历史
  const clearHistory = () => {
    setMessages([])
    localStorage.removeItem('translationMessages')
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
              <h1 className="text-xl font-bold">AI 翻译助手</h1>
              <p className="text-xs text-blue-100">智能文本翻译工具</p>
            </div>
          </div>
          <div className="flex space-x-2">
            {messages.length > 0 && (
              <button
                onClick={clearHistory}
                className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm text-xs"
                title="清除历史记录"
              >
                清除
              </button>
            )}
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all duration-200 backdrop-blur-sm"
            >
              <Cog6ToothIcon className="w-5 h-5" />
            </button>
          </div>
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
                <ArrowsRightLeftIcon className="w-10 h-10 text-blue-500" />
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full flex items-center justify-center">
                <SparklesIcon className="w-3 h-3 text-white" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">开始你的翻译之旅</h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">输入需要翻译的文本，AI将为你生成翻译结果</p>
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

      {/* Notification */}
      {notification && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 10000 }}>
          <div className={`px-4 py-2 rounded-lg text-sm font-medium text-white text-center max-w-xs pointer-events-auto ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
            {notification.message}
          </div>
        </div>
      )}

      {/* Input with glassmorphism */}
      <div className="p-4 bg-white/80 backdrop-blur-sm border-t border-gray-200/50">
        <div className="flex space-x-3">
          <textarea
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入需要翻译的文本..."
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
