import React, { useState, useEffect } from 'react'
import { APIConfig, APIManager } from '../config/api'
import { XMarkIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface SettingsProps {
  isOpen: boolean
  onClose: () => void
  onConfigSaved?: () => void
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, onConfigSaved }) => {
  const [config, setConfig] = useState<APIConfig>({
    endpoint: '',
    apiKey: '',
    provider: 'custom',
    model: '',
    maxTokens: 500,
    temperature: 0.3,
    requestMethod: 'GET',
    promptParamKey: 'q'
  })
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [skipValidation, setSkipValidation] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadConfig()
    }
  }, [isOpen])

  const loadConfig = async () => {
    try {
      const savedConfig = await APIManager.getInstance().getConfig()
      if (savedConfig) {
        setConfig({
          endpoint: savedConfig.endpoint || '',
          apiKey: savedConfig.apiKey || '',
          provider: savedConfig.provider || 'custom',
          model: savedConfig.model || '',
          maxTokens: savedConfig.maxTokens ?? 500,
          temperature: savedConfig.temperature ?? 0.3,
          requestMethod: (savedConfig.requestMethod as 'GET' | 'POST') || 'GET',
          promptParamKey: savedConfig.promptParamKey || 'q'
        })
      }
    } catch (error) {
      console.error('加载配置失败:', error)
    }
  }

  const handleSave = async () => {
    const provider = config.provider || 'custom'
    if (provider === 'custom') {
      if (!config.endpoint) {
        setMessage('请填写API端点')
        return
      }
    } else {
      if (!config.apiKey) {
        setMessage('请填写API密钥')
        return
      }
    }

    setIsLoading(true)
    setMessage('')

    try {
      // 规范化：若未填写参数键名，则根据方法提供默认值（GET->q，POST->prompt）
      const method = (config.requestMethod || 'GET') as 'GET' | 'POST'
      const promptKey = (config.promptParamKey || '').trim() || (method === 'GET' ? 'q' : 'prompt')

      const normalized = { ...config, requestMethod: method, promptParamKey: promptKey }
      await APIManager.getInstance().setConfig(normalized)

      if (skipValidation) {
        setMessage('配置保存成功（已跳过验证）！')
        onConfigSaved?.()
        setTimeout(() => {
          onClose()
        }, 800)
        return
      }

      // 验证配置
      const isValid = await APIManager.getInstance().validateConfig(normalized)
      if (isValid) {
        setMessage('配置保存成功！')
        onConfigSaved?.()
        setTimeout(() => {
          onClose()
        }, 800)
      } else {
        setMessage('配置验证失败，请检查API设置')
      }
    } catch (error) {
      setMessage(`保存失败: ${error instanceof Error ? error.message : '未知错误'}`)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  const isCustom = (config.provider || 'custom') === 'custom'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-all duration-200 opacity-100">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl border border-gray-200/50 transition-all duration-200 scale-100">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
              <CheckCircleIcon className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">API设置</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all duration-200"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5">
          {/* 模式提示（公司内部API） */}
          {isCustom && (
            <div className="text-sm text-gray-600 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              当前使用：公司内部自有API。端点必填，密钥可选。
            </div>
          )}

          {/* API端点 */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">API端点</label>
            <input
              type="text"
              value={config.endpoint}
              onChange={e => setConfig(prev => ({ ...prev, endpoint: e.target.value }))}
              placeholder={config.endpoint ? config.endpoint : 'https://your-company-api.com/generate-sql'}
              className="w-full p-3 border border-gray-300/50 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* API密钥（可选） */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-3">API密钥（可选）</label>
            <input
              type="password"
              value={config.apiKey}
              onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="sk-..."
              className="w-full p-3 border border-gray-300/50 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
            />
          </div>

          {/* 自定义接口高级设置（仅 custom 显示） */}
          {isCustom && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">请求方法</label>
                <select
                  value={config.requestMethod || 'GET'}
                  onChange={e =>
                    setConfig(prev => ({ ...prev, requestMethod: (e.target.value as 'GET' | 'POST') || 'GET' }))
                  }
                  className="w-full p-3 border border-gray-300/50 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">参数键名</label>
                <input
                  type="text"
                  value={config.promptParamKey || ''}
                  onChange={e => setConfig(prev => ({ ...prev, promptParamKey: e.target.value }))}
                  placeholder={(config.requestMethod || 'GET') === 'GET' ? 'q' : 'prompt'}
                  className="w-full p-3 border border-gray-300/50 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
          )}

          {/* 跳过验证 */}
          <div className="flex items-center space-x-3">
            <input
              id="skipValidation"
              type="checkbox"
              checked={skipValidation}
              onChange={e => setSkipValidation(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="skipValidation" className="text-sm text-gray-700">
              保存后跳过验证（当你的接口是 SSE/非JSON 或临时不可访问时勾选）
            </label>
          </div>

          {/* 仅当不是custom时显示第三方高级设置 */}
          {!isCustom && (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">模型</label>
                <select
                  value={config.model}
                  onChange={e => setConfig(prev => ({ ...prev, model: e.target.value }))}
                  className="w-full p-3 border border-gray-300/50 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                >
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">最大Token数</label>
                  <input
                    type="number"
                    value={config.maxTokens}
                    onChange={e => setConfig(prev => ({ ...prev, maxTokens: parseInt(e.target.value) || 500 }))}
                    min="100"
                    max="4000"
                    className="w-full p-3 border border-gray-300/50 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">温度</label>
                  <input
                    type="number"
                    value={config.temperature}
                    onChange={e => setConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) || 0.3 }))}
                    min="0"
                    max="2"
                    step="0.1"
                    className="w-full p-3 border border-gray-300/50 rounded-xl bg-white/50 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>
            </>
          )}

          {/* 消息提示 */}
          {message && (
            <div
              className={`p-3 rounded-xl flex items-center space-x-2 ${
                message.includes('成功')
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : message.includes('失败')
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-blue-50 text-blue-700 border border-blue-200'
              }`}
            >
              {message.includes('成功') ? (
                <CheckCircleIcon className="w-5 h-5 text-green-600" />
              ) : message.includes('失败') ? (
                <ExclamationTriangleIcon className="w-5 h-5 text-red-600" />
              ) : (
                <ExclamationTriangleIcon className="w-5 h-5 text-blue-600" />
              )}
              <span className="text-sm font-medium">{message}</span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex space-x-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium transition-all duration-200"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 font-medium shadow-md transition-all duration-200 transform hover:scale-105 disabled:transform-none disabled:opacity-50"
            >
              {isLoading ? '保存中...' : '保存'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings
