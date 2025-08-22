// Content Script - 注入到网页中
import './content.css'

class SQLCopilotContent {
  private panel: HTMLDivElement | null = null
  private isVisible = false
  private messageContainer: HTMLDivElement | null = null

  constructor() {
    this.init()
  }

  private init() {
    // 监听来自popup的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'insertSQL') {
        this.insertSQLToPage(request.sql)
        sendResponse({ success: true })
        return true // 保持消息通道开放
      }
    })

    // 创建浮动面板
    this.createFloatingPanel()

    // 创建消息容器
    this.createMessageContainer()

    // 添加键盘快捷键
    this.addKeyboardShortcuts()
  }

  private createMessageContainer() {
    this.messageContainer = document.createElement('div')
    this.messageContainer.id = 'sql-copilot-messages'
    this.messageContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      width: 300px;
      pointer-events: none;
    `
    document.body.appendChild(this.messageContainer)
  }

  private showMessage(message: string, type: 'success' | 'error' = 'success') {
    if (!this.messageContainer) return

    const messageElement = document.createElement('div')
    const backgroundColor = type === 'success' ? '#4caf50' : '#f44336'
    
    messageElement.style.cssText = `
      padding: 12px 16px;
      margin-bottom: 10px;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transform: translateX(100%);
      opacity: 0;
      transition: all 0.3s ease-in-out;
      pointer-events: auto;
      background: ${backgroundColor};
    `

    messageElement.textContent = message

    this.messageContainer.appendChild(messageElement)

    // 触发重排后执行动画
    setTimeout(() => {
      messageElement.style.transform = 'translateX(0)'
      messageElement.style.opacity = '1'
    }, 10)

    // 3秒后自动移除消息
    setTimeout(() => {
      messageElement.style.transform = 'translateX(100%)'
      messageElement.style.opacity = '0'
      
      // 动画结束后移除元素
      setTimeout(() => {
        if (messageElement.parentNode === this.messageContainer) {
          this.messageContainer!.removeChild(messageElement)
        }
      }, 300)
    }, 3000)
  }

  private createFloatingPanel() {
    // 创建主面板
    this.panel = document.createElement('div')
    this.panel.id = 'sql-copilot-panel'
    this.panel.innerHTML = `
      <div class="sql-copilot-header">
        <span>SQL Copilot</span>
        <button class="sql-copilot-close">×</button>
      </div>
      <div class="sql-copilot-content">
        <textarea placeholder="描述你需要的SQL查询..." class="sql-copilot-input"></textarea>
        <button class="sql-copilot-send">生成SQL</button>
      </div>
      <div class="sql-copilot-result" style="display: none;">
        <div class="sql-copilot-sql"></div>
        <div class="sql-copilot-actions">
          <button class="sql-copilot-copy">复制</button>
          <button class="sql-copilot-insert">插入到页面</button>
        </div>
      </div>
    `

    // 添加样式
    this.panel.className = 'sql-copilot-panel'

    // 添加到页面
    document.body.appendChild(this.panel)

    // 绑定事件
    this.bindPanelEvents()

    // 默认隐藏
    this.hidePanel()
  }

  private bindPanelEvents() {
    if (!this.panel) return

    // 关闭按钮
    const closeBtn = this.panel.querySelector('.sql-copilot-close')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.hidePanel())
    }

    // 发送按钮
    const sendBtn = this.panel.querySelector('.sql-copilot-send')
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.generateSQL())
    }

    // 复制按钮
    const copyBtn = this.panel.querySelector('.sql-copilot-copy')
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copySQL())
    }

    // 插入按钮
    const insertBtn = this.panel.querySelector('.sql-copilot-insert')
    if (insertBtn) {
      insertBtn.addEventListener('click', () => this.insertSQL())
    }

    // 拖拽功能
    this.makeDraggable()
  }

  private makeDraggable() {
    if (!this.panel) return

    let isDragging = false
    let currentX: number
    let currentY: number
    let initialX: number
    let initialY: number
    let xOffset = 0
    let yOffset = 0

    const header = this.panel.querySelector('.sql-copilot-header')
    if (!header) return

    header.addEventListener('mousedown', e => {
      initialX = e.clientX - xOffset
      initialY = e.clientY - yOffset

      if (e.target === header || header.contains(e.target as Node)) {
        isDragging = true
      }
    })

    document.addEventListener('mousemove', e => {
      if (isDragging) {
        e.preventDefault()
        currentX = e.clientX - initialX
        currentY = e.clientY - initialY

        xOffset = currentX
        yOffset = currentY

        this.setTranslate(currentX, currentY, this.panel!)
      }
    })

    document.addEventListener('mouseup', () => {
      initialX = currentX
      initialY = currentY
      isDragging = false
    })
  }

  private setTranslate(xPos: number, yPos: number, el: HTMLElement) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`
  }

  private async generateSQL() {
    if (!this.panel) return

    const input = this.panel.querySelector('.sql-copilot-input') as HTMLTextAreaElement
    const prompt = input.value.trim()

    if (!prompt) return

    try {
      // 这里调用你的AI API
      const sql = await this.callAIAPI(prompt)
      this.showResult(sql)
    } catch (error) {
      console.error('生成SQL失败:', error)
      this.showMessage('生成SQL失败，请重试', 'error')
    }
  }

  private async callAIAPI(prompt: string): Promise<string> {
    // 这里替换为你的AI API调用
    // 示例：
    const response = await fetch('YOUR_AI_API_ENDPOINT', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer YOUR_API_KEY'
      },
      body: JSON.stringify({
        prompt: `请根据以下描述生成SQL查询：${prompt}`,
        max_tokens: 500
      })
    })

    if (!response.ok) {
      throw new Error('API请求失败')
    }

    const data = await response.json()
    return data.choices?.[0]?.text || '无法生成SQL查询'
  }

  private showResult(sql: string) {
    if (!this.panel) return

    const resultDiv = this.panel.querySelector('.sql-copilot-result') as HTMLDivElement
    const sqlDiv = this.panel.querySelector('.sql-copilot-sql') as HTMLDivElement

    if (resultDiv && sqlDiv) {
      sqlDiv.textContent = sql
      resultDiv.style.display = 'block'
    }
  }

  private copySQL() {
    if (!this.panel) return

    const sqlDiv = this.panel.querySelector('.sql-copilot-sql') as HTMLDivElement
    if (sqlDiv) {
      navigator.clipboard.writeText(sqlDiv.textContent || '')
      this.showMessage('已复制到剪贴板', 'success')
    }
  }

  private insertSQL() {
    if (!this.panel) return

    const sqlDiv = this.panel.querySelector('.sql-copilot-sql') as HTMLDivElement
    const sql = sqlDiv.textContent || ''

    if (sql) {
      this.insertSQLToPage(sql)
    }
  }

  private insertSQLToPage(sql: string) {
    // 查找页面中的SQL输入框
    const sqlInputs = this.findSQLInputs()

    if (sqlInputs.length > 0) {
      // 如果有多个输入框，选择第一个
      const targetInput = sqlInputs[0]

      // 插入SQL
      if (targetInput.tagName === 'TEXTAREA' || targetInput.tagName === 'INPUT') {
        ;(targetInput as HTMLInputElement | HTMLTextAreaElement).value = sql

        // 触发change事件
        targetInput.dispatchEvent(new Event('input', { bubbles: true }))
        targetInput.dispatchEvent(new Event('change', { bubbles: true }))

        // 尝试自动执行
        this.autoExecuteSQL(targetInput)

        this.showMessage('已插入到页面中', 'success')
      }
    } else {
      this.showMessage('未找到输入框', 'error')
    }
  }

  private findSQLInputs(): HTMLElement[] {
    // 查找可能的SQL输入框
    const selectors = [
      'textarea[placeholder*="sql" i]',
      'textarea[placeholder*="查询" i]',
      'textarea[placeholder*="语句" i]',
      'input[placeholder*="sql" i]',
      'input[placeholder*="查询" i]',
      'input[placeholder*="语句" i]',
      '.sql-input',
      '.query-input',
      '[data-testid*="sql" i]',
      '[data-testid*="query" i]'
    ]

    const inputs: HTMLElement[] = []

    selectors.forEach(selector => {
      try {
        const elements = document.querySelectorAll(selector)
        elements.forEach(el => {
          if (el instanceof HTMLElement) {
            inputs.push(el)
          }
        })
      } catch (e) {
        // 忽略无效选择器
      }
    })

    return inputs
  }

  private autoExecuteSQL(inputElement: HTMLElement) {
    // 查找执行按钮
    const executeButtons = this.findExecuteButtons(inputElement)

    if (executeButtons.length > 0) {
      // 自动点击执行按钮
      executeButtons[0].click()
    }
  }

  private findExecuteButtons(inputElement: HTMLElement): HTMLElement[] {
    // 在输入框附近查找执行按钮
    const buttons: HTMLElement[] = []

    // 查找父容器中的按钮
    let parent = inputElement.parentElement
    while (parent && parent !== document.body) {
      const buttonSelectors = [
        'button[type="submit"]',
        'button:contains("执行")',
        'button:contains("运行")',
        'button:contains("查询")',
        'button:contains("Submit")',
        'button:contains("Run")',
        'button:contains("Query")',
        '.execute-btn',
        '.run-btn',
        '.submit-btn'
      ]

      buttonSelectors.forEach(selector => {
        try {
          const elements = parent.querySelectorAll(selector)
          elements.forEach(el => {
            if (el instanceof HTMLElement) {
              buttons.push(el)
            }
          })
        } catch (e) {
          // 忽略无效选择器
        }
      })

      parent = parent.parentElement
    }

    return buttons
  }

  private addKeyboardShortcuts() {
    // 添加快捷键 Ctrl+Shift+S 显示/隐藏面板
    document.addEventListener('keydown', e => {
      if (e.ctrlKey && e.shiftKey && e.key === 'S') {
        e.preventDefault()
        this.togglePanel()
      }
    })
  }

  public showPanel() {
    if (this.panel) {
      this.panel.style.display = 'block'
      this.isVisible = true
    }
  }

  public hidePanel() {
    if (this.panel) {
      this.panel.style.display = 'none'
      this.isVisible = false
    }
  }

  public togglePanel() {
    if (this.isVisible) {
      this.hidePanel()
    } else {
      this.showPanel()
    }
  }
}

// 初始化
new SQLCopilotContent()
