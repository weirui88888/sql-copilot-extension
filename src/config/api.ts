// API配置管理
export interface APIConfig {
  endpoint: string
  apiKey?: string
  provider?: 'custom' | 'aliyun'
  model?: string
  maxTokens?: number
  temperature?: number
  // 自定义接口可选：请求方法与参数键名
  requestMethod?: 'GET' | 'POST'
  promptParamKey?: string
  // 阿里云翻译配置
  sourceLang?: string
  targetLang?: string
}

export class APIManager {
  private static instance: APIManager
  private config: APIConfig | null = null

  private constructor() {}

  public static getInstance(): APIManager {
    if (!APIManager.instance) {
      APIManager.instance = new APIManager()
    }
    return APIManager.instance
  }

  public async getConfig(): Promise<APIConfig | null> {
    if (this.config) {
      return this.config
    }

    try {
      const result = await chrome.storage.sync.get(['apiConfig'])
      const stored: APIConfig | null = result.apiConfig || null
      // 容错：若未设置provider，则默认为 custom
      if (stored && !stored.provider) {
        stored.provider = 'custom'
      }
      this.config = stored
      return this.config
    } catch (error) {
      console.error('获取API配置失败:', error)
      return null
    }
  }

  public async setConfig(config: APIConfig): Promise<void> {
    try {
      // 确保provider默认是custom
      const normalized: APIConfig = {
        provider: 'custom',
        maxTokens: 500,
        temperature: 0.3,
        requestMethod: config.requestMethod || 'POST',
        promptParamKey: config.promptParamKey || 'prompt',
        sourceLang: config.sourceLang || 'Chinese',
        targetLang: config.targetLang || 'English',
        ...config
      }
      await chrome.storage.sync.set({ apiConfig: normalized })
      this.config = normalized
    } catch (error) {
      console.error('保存API配置失败:', error)
      throw error
    }
  }

  public async callAPI(prompt: string): Promise<string> {
    const config = await this.getConfig()
    if (!config) {
      throw new Error('API配置未设置')
    }

    const provider = config.provider || 'custom'
    switch (provider) {
      case 'aliyun':
        return this.callAliyunTranslate(prompt, config)
      case 'custom':
      default:
        return this.callCustomAPI(prompt, config)
    }
  }

  // 流式API调用
  public async callAPIStream(prompt: string, onChunk: (chunk: string) => void): Promise<void> {
    const config = await this.getConfig()
    if (!config) {
      throw new Error('API配置未设置')
    }

    const provider = config.provider || 'custom'
    switch (provider) {
      case 'aliyun':
        return this.callAliyunTranslateStream(prompt, config, onChunk)
      case 'custom':
      default:
        return this.callCustomAPIStream(prompt, config, onChunk)
    }
  }

  private async callOpenAI(prompt: string, config: APIConfig): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey || ''}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的SQL专家，请根据用户描述生成准确、高效的SQL查询语句。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: config.maxTokens || 500,
        temperature: config.temperature || 0.3
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI API错误: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return data.choices[0]?.message?.content || '无法生成SQL查询'
  }

  private async callOpenAIStream(prompt: string, config: APIConfig, onChunk: (chunk: string) => void): Promise<void> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey || ''}`
      },
      body: JSON.stringify({
        model: config.model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的SQL专家，请根据用户描述生成准确、高效的SQL查询语句。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: config.maxTokens || 500,
        temperature: config.temperature || 0.3,
        stream: true // 启用流式输出
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`OpenAI API错误: ${error.error?.message || response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取流式响应')
    }

    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      
      // 处理缓冲区中的完整行
      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        
        // 处理以 data: 开头的行（OpenAI 格式）
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          if (!data) continue
          
          // 如果是结束标记，则退出
          if (data === '[DONE]') {
            return
          }
          
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content
            if (content) {
              onChunk(content)
            }
          } catch (e) {
            // 忽略解析错误
          }
        } 
        // 处理直接的 JSON 对象（兼容其他格式）
        else if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const parsed = JSON.parse(line)
            const content = 
              parsed.choices?.[0]?.delta?.content || parsed.response || parsed.sql || parsed.text || parsed.content || parsed.delta || parsed.choices?.[0]?.text || ''
            if (content && typeof content === 'string') {
              onChunk(content)
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
    
    // 处理缓冲区中剩余的内容
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim())
        const content = 
          parsed.choices?.[0]?.delta?.content || parsed.response || parsed.sql || parsed.text || parsed.content || parsed.delta || parsed.choices?.[0]?.text || ''
        if (content && typeof content === 'string') {
          onChunk(content)
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  }

  private async callClaude(prompt: string, config: APIConfig): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-sonnet-20240229',
        max_tokens: config.maxTokens || 500,
        messages: [
          {
            role: 'user',
            content: `你是一个专业的SQL专家，请根据以下描述生成准确、高效的SQL查询语句：${prompt}`
          }
        ]
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Claude API错误: ${error.error?.message || response.statusText}`)
    }

    const data = await response.json()
    return data.content[0]?.text || '无法生成SQL查询'
  }

  private async callClaudeStream(prompt: string, config: APIConfig, onChunk: (chunk: string) => void): Promise<void> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey || '',
        'anthropic-version': '2023-06-01',
        'Accept': 'text/event-stream'
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-sonnet-20240229',
        max_tokens: config.maxTokens || 500,
        messages: [
          {
            role: 'user',
            content: `你是一个专业的SQL专家，请根据以下描述生成准确、高效的SQL查询语句：${prompt}`
          }
        ],
        stream: true // 启用流式输出
      })
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(`Claude API错误: ${error.error?.message || response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取流式响应')
    }

    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      
      // 处理缓冲区中的完整行
      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        
        // 处理以 data: 开头的行（Claude 格式）
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          if (!data) continue
          
          // 如果是结束标记，则退出
          if (data === '[DONE]') {
            return
          }
          
          try {
            const parsed = JSON.parse(data)
            const content = parsed.delta?.text
            if (content) {
              onChunk(content)
            }
          } catch (e) {
            // 忽略解析错误
          }
        } 
        // 处理直接的 JSON 对象（兼容其他格式）
        else if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const parsed = JSON.parse(line)
            const content = 
              parsed.delta?.text || parsed.response || parsed.sql || parsed.text || parsed.content || parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || ''
            if (content && typeof content === 'string') {
              onChunk(content)
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
    
    // 处理缓冲区中剩余的内容
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim())
        const content = 
          parsed.delta?.text || parsed.response || parsed.sql || parsed.text || parsed.content || parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || ''
        if (content && typeof content === 'string') {
          onChunk(content)
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  }

  private async callAliyunTranslate(prompt: string, config: APIConfig): Promise<string> {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey || ''}`,
        'Content-Type': 'application/json'
        // 注意：非流式请求不添加 X-DashScope-SSE 头
      },
      body: JSON.stringify({
        model: config.model || 'qwen-mt-turbo',
        input: {
          messages: [
            {
              content: prompt,
              role: 'user'
            }
          ]
        },
        parameters: {
          translation_options: {
            source_lang: config.sourceLang || 'Chinese',
            target_lang: config.targetLang || 'English'
          }
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`阿里云翻译API错误: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    return data.output?.choices?.[0]?.message?.content || '无法生成翻译结果'
  }

  private async callAliyunTranslateStream(prompt: string, config: APIConfig, onChunk: (chunk: string) => void): Promise<void> {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey || ''}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'enable'  // 启用流式输出
      },
      body: JSON.stringify({
        model: config.model || 'qwen-mt-turbo',
        input: {
          messages: [
            {
              content: prompt,
              role: 'user'
            }
          ]
        },
        parameters: {
          translation_options: {
            source_lang: config.sourceLang || 'Chinese',
            target_lang: config.targetLang || 'English'
          }
        }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`阿里云翻译API错误: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取流式响应')
    }

    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let previousContent = ''  // 记录之前的内容，用于去重

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      
      // 处理缓冲区中的完整行
      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        
        // 处理以 data: 开头的行（阿里云SSE格式）
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          if (!data) continue
          
          // 如果是结束标记，则退出
          if (data === '[DONE]') {
            return
          }
          
          try {
            const parsed = JSON.parse(data)
            
            // 优先处理增量内容
            const deltaContent = parsed.output?.choices?.[0]?.delta?.content
            if (deltaContent) {
              // 检查是否是新的内容，避免重复
              if (!previousContent.endsWith(deltaContent)) {
                previousContent += deltaContent
                onChunk(deltaContent)
              }
              continue
            }
            
            // 处理完整内容（某些情况下可能直接返回完整内容）
            const fullContent = parsed.output?.choices?.[0]?.message?.content
            if (fullContent) {
              // 只发送新增的部分
              if (fullContent.length > previousContent.length) {
                const newContent = fullContent.slice(previousContent.length)
                previousContent = fullContent
                onChunk(newContent)
              }
              continue
            }
          } catch (e) {
            // 忽略解析错误
          }
        } 
        // 处理直接的 JSON 对象（兼容其他格式）
        else if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const parsed = JSON.parse(line)
            
            // 优先处理增量内容
            const deltaContent = parsed.output?.choices?.[0]?.delta?.content
            if (deltaContent) {
              // 检查是否是新的内容，避免重复
              if (!previousContent.endsWith(deltaContent)) {
                previousContent += deltaContent
                onChunk(deltaContent)
              }
              continue
            }
            
            // 处理完整内容
            const fullContent = parsed.output?.choices?.[0]?.message?.content
            if (fullContent) {
              // 只发送新增的部分
              if (fullContent.length > previousContent.length) {
                const newContent = fullContent.slice(previousContent.length)
                previousContent = fullContent
                onChunk(newContent)
              }
              continue
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
    
    // 处理缓冲区中剩余的内容
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim())
        
        // 优先处理增量内容
        const deltaContent = parsed.output?.choices?.[0]?.delta?.content
        if (deltaContent) {
          // 检查是否是新的内容，避免重复
          if (!previousContent.endsWith(deltaContent)) {
            previousContent += deltaContent
            onChunk(deltaContent)
          }
          return
        }
        
        // 处理完整内容
        const fullContent = parsed.output?.choices?.[0]?.message?.content
        if (fullContent) {
          // 只发送新增的部分
          if (fullContent.length > previousContent.length) {
            const newContent = fullContent.slice(previousContent.length)
            previousContent = fullContent
            onChunk(newContent)
          }
          return
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  }

  private async callCustomAPI(prompt: string, config: APIConfig): Promise<string> {
    if (!config.endpoint) {
      throw new Error('自定义API端点未配置')
    }

    const requestMethod = (config.requestMethod || 'POST').toUpperCase()
    const promptParamKey = config.promptParamKey || 'prompt'

    if (requestMethod === 'GET') {
      // GET：仅携带一个查询参数（自定义键名），适配简单 GET 接口（如 q=...）
      const url = new URL(config.endpoint)
      url.searchParams.set(promptParamKey, prompt)

      const headers: Record<string, string> = {
        Accept: 'text/event-stream, application/x-ndjson, application/json;q=0.9, */*;q=0.8'
      }
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`
      }

      const response = await fetch(url.toString(), { method: 'GET', headers })
      if (!response.ok) {
        throw new Error(`自定义API错误: ${response.status} ${response.statusText}`)
      }

      const contentType = response.headers.get('content-type') || ''
      // 若是 JSON 且非流式，直接解析一次
      if (contentType.includes('application/json') && !contentType.includes('ndjson')) {
        try {
          const data = await response.json()
          return data.sql || data.text || data.content || data.result || data.choices?.[0]?.text || JSON.stringify(data)
        } catch {
          // 无法直接按JSON解析时，继续用流式/文本路径
        }
      }

      // 尝试以流式逐行解析（兼容 text/event-stream 或 NDJSON 或纯文本分行JSON）
      const reader = response.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder('utf-8')
        let buffer = ''
        let resultText = ''

        const processLine = (raw: string) => {
          let line = raw.trim()
          if (!line) return
          if (line.startsWith('data:')) {
            line = line.slice(5).trim()
            if (!line) return
          }
          try {
            const obj = JSON.parse(line)
            const piece =
              obj.response || obj.sql || obj.text || obj.content || obj.delta || obj.choices?.[0]?.text || ''
            if (typeof piece === 'string') {
              resultText += piece
            }
            // 如果协议里声明 done=true，则忽略后续
            // 不强制停止读取，让 reader 自然结束，避免丢尾
          } catch {
            // 非JSON，直接拼接
            resultText += line
          }
        }

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let idx: number
          while ((idx = buffer.indexOf('\n')) >= 0) {
            const line = buffer.slice(0, idx)
            buffer = buffer.slice(idx + 1)
            processLine(line)
          }
        }

        if (buffer.trim()) {
          processLine(buffer)
        }

        return resultText || '无法生成SQL查询'
      }

      // 非可读流：退化为纯文本并尝试逐行提取 response
      const rawText = await response.text()
      if (!rawText) return '无法生成SQL查询'
      try {
        // 优先尝试整体作为 JSON
        const data = JSON.parse(rawText)
        return data.sql || data.text || data.content || data.result || data.choices?.[0]?.text || rawText
      } catch {
        // 逐行 JSON 提取 response 字段
        const lines = rawText.split(/\r?\n/)
        let resultText = ''
        for (const ln of lines) {
          const t = ln.trim().replace(/^data:\s*/, '')
          if (!t) continue
          try {
            const obj = JSON.parse(t)
            const piece =
              obj.response || obj.sql || obj.text || obj.content || obj.delta || obj.choices?.[0]?.text || ''
            if (typeof piece === 'string') {
              resultText += piece
            }
          } catch {
            resultText += t
          }
        }
        return resultText || rawText
      }
    }

    // POST：按 JSON 发送，使用自定义键名承载 prompt
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`
    }

    const body: Record<string, unknown> = {
      // 使用自定义键名承载 prompt
      [promptParamKey]: prompt,
      // 公司内部API常见字段；如果你们的接口不同，也能兼容忽略
      purpose: 'generate_sql',
      max_tokens: config.maxTokens || 500,
      temperature: config.temperature || 0.3
    }

    const response = await fetch(config.endpoint, { method: 'POST', headers, body: JSON.stringify(body) })

    if (!response.ok) {
      throw new Error(`自定义API错误: ${response.status} ${response.statusText}`)
    }

    const data = await response.json()
    // 兼容常见返回格式
    return data.sql || data.text || data.content || data.result || data.choices?.[0]?.text || '无法生成SQL查询'
  }

  private async callCustomAPIStream(prompt: string, config: APIConfig, onChunk: (chunk: string) => void): Promise<void> {
    if (!config.endpoint) {
      throw new Error('自定义API端点未配置')
    }

    const requestMethod = (config.requestMethod || 'POST').toUpperCase()
    const promptParamKey = config.promptParamKey || 'prompt'

    let response: Response
    if (requestMethod === 'GET') {
      // GET请求处理
      const url = new URL(config.endpoint)
      url.searchParams.set(promptParamKey, prompt)

      const headers: Record<string, string> = {
        Accept: 'text/event-stream, application/x-ndjson, application/json;q=0.9, */*;q=0.8'
      }
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`
      }

      response = await fetch(url.toString(), { method: 'GET', headers })
    } else {
      // POST请求处理
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`
      }

      const body: Record<string, unknown> = {
        [promptParamKey]: prompt,
        purpose: 'generate_sql',
        max_tokens: config.maxTokens || 500,
        temperature: config.temperature || 0.3,
        stream: true // 启用流式输出
      }

      response = await fetch(config.endpoint, { method: 'POST', headers, body: JSON.stringify(body) })
    }

    if (!response.ok) {
      throw new Error(`自定义API错误: ${response.status} ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取流式响应')
    }

    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      
      // 处理缓冲区中的完整行
      let idx: number
      while ((idx = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, idx).trim()
        buffer = buffer.slice(idx + 1)
        
        // 处理以 data: 开头的行（OpenAI/Claude 格式）
        if (line.startsWith('data:')) {
          const data = line.slice(5).trim()
          if (!data) continue
          
          // 如果是结束标记，则退出
          if (data === '[DONE]') {
            return
          }
          
          try {
            const parsed = JSON.parse(data)
            const content = 
              parsed.response || parsed.sql || parsed.text || parsed.content || parsed.delta || parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || ''
            if (content && typeof content === 'string') {
              onChunk(content)
            }
          } catch (e) {
            // 忽略解析错误
          }
        } 
        // 处理直接的 JSON 对象（你当前的格式）
        else if (line.startsWith('{') && line.endsWith('}')) {
          try {
            const parsed = JSON.parse(line)
            const content = 
              parsed.response || parsed.sql || parsed.text || parsed.content || parsed.delta || parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || ''
            if (content && typeof content === 'string') {
              onChunk(content)
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
    
    // 处理缓冲区中剩余的内容
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim())
        const content = 
          parsed.response || parsed.sql || parsed.text || parsed.content || parsed.delta || parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || ''
        if (content && typeof content === 'string') {
          onChunk(content)
        }
      } catch (e) {
        // 忽略解析错误
      }
    }
  }

  public async validateConfig(config: APIConfig): Promise<boolean> {
    try {
      const normalized: APIConfig = { ...config, provider: config.provider || 'custom' }
      const testPrompt = normalized.provider === 'aliyun' 
        ? '你好世界' 
        : '生成一个简单的SELECT语句'

      let text = ''
      switch (normalized.provider) {
        case 'aliyun':
          text = await this.callAliyunTranslate(testPrompt, normalized)
          break
        case 'custom':
        default:
          text = await this.callCustomAPI(testPrompt, normalized)
          break
      }

      return typeof text === 'string' && text.length > 0
    } catch (error) {
      console.error('API配置验证失败:', error)
      return false
    }
  }
}

export default APIManager.getInstance()