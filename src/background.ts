// Background Script - 插件的后台脚本
chrome.runtime.onInstalled.addListener(() => {
  console.log('SQL Copilot 插件已安装')
})

// 监听来自content script的消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openPanel') {
    // 向当前标签页发送消息，显示面板
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]?.id) {
        chrome.tabs
          .sendMessage(tabs[0].id, {
            action: 'showPanel'
          })
          .catch(error => {
            console.error('发送消息失败:', error)
          })
      }
    })
    sendResponse({ success: true })
  }
})

// 添加快捷键支持 - 添加安全检查
if (chrome.commands) {
  try {
    chrome.commands.onCommand.addListener(command => {
      if (command === 'toggle-panel') {
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
          if (tabs[0]?.id) {
            chrome.tabs
              .sendMessage(tabs[0].id, {
                action: 'togglePanel'
              })
              .catch(error => {
                console.error('发送消息失败:', error)
              })
          }
        })
      }
    })
  } catch (error) {
    console.warn('Commands API 不可用:', error)
  }
}
