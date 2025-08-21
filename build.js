#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

console.log('🚀 开始构建 SQL Copilot 插件...')

// 检查依赖是否安装
try {
  require.resolve('vite')
} catch (e) {
  console.log('📦 安装依赖...')
  execSync('npm install', { stdio: 'inherit' })
}

// 构建项目
console.log('🔨 构建项目...')
execSync('npm run build', { stdio: 'inherit' })

// 复制manifest.json到dist目录
console.log('📋 复制配置文件...')
const manifestPath = path.join(__dirname, 'manifest.json')
const distManifestPath = path.join(__dirname, 'dist', 'manifest.json')

if (fs.existsSync(manifestPath)) {
  fs.copyFileSync(manifestPath, distManifestPath)
  console.log('✅ manifest.json 已复制')
} else {
  console.log('❌ manifest.json 未找到')
}

// 复制popup.html到dist目录
console.log('📄 复制popup.html...')
const popupHtmlPath = path.join(__dirname, 'src', 'popup.html')
const distPopupHtmlPath = path.join(__dirname, 'dist', 'popup.html')

if (fs.existsSync(popupHtmlPath)) {
  // 读取HTML内容
  let htmlContent = fs.readFileSync(popupHtmlPath, 'utf8')

  // 替换脚本引用：从 .tsx 改为 .js
  htmlContent = htmlContent.replace('./popup.tsx', './popup.js')

  // 确保CSS引用存在
  if (!htmlContent.includes('./popup.css')) {
    htmlContent = htmlContent.replace(
      '<script type="module" src="./popup.js">',
      '<link rel="stylesheet" href="./popup.css">\n  <script type="module" src="./popup.js">'
    )
  }

  // 写入修复后的HTML文件
  fs.writeFileSync(distPopupHtmlPath, htmlContent)
  console.log('✅ popup.html 已复制并修复')
} else {
  console.log('❌ popup.html 未找到')
}

// 创建图标文件夹
const iconsDir = path.join(__dirname, 'dist', 'icons')
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
  console.log('📁 创建图标文件夹')
}

// 检查图标文件
const iconFiles = ['icon16.png', 'icon48.png', 'icon128.png']
const sourceIconsDir = path.join(__dirname, 'icons')

iconFiles.forEach(iconFile => {
  const sourcePath = path.join(sourceIconsDir, iconFile)
  const destPath = path.join(iconsDir, iconFile)

  if (fs.existsSync(sourcePath)) {
    fs.copyFileSync(sourcePath, destPath)
    console.log(`✅ ${iconFile} 已复制`)
  } else {
    console.log(`⚠️  ${iconFile} 未找到，请手动添加图标文件`)
  }
})

console.log('\n🎉 构建完成！')
console.log('\n📖 安装说明:')
console.log('1. 打开Chrome浏览器')
console.log('2. 进入 chrome://extensions/')
console.log('3. 开启"开发者模式"')
console.log('4. 点击"加载已解压的扩展程序"')
console.log('5. 选择 dist 文件夹')
console.log('\n💡 提示: 如果没有图标文件，插件仍然可以工作，但会显示默认图标')
