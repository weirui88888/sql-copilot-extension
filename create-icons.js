const fs = require('fs')
const path = require('path')

// 创建简单的PNG图标数据（最小的PNG文件）
function createMinimalPNG(size) {
  // 这是一个最小的PNG文件结构
  const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  // IHDR chunk
  const width = Buffer.alloc(4)
  const height = Buffer.alloc(4)
  width.writeUInt32BE(size, 0)
  height.writeUInt32BE(size, 0)

  const ihdrData = Buffer.concat([
    Buffer.from([0x49, 0x48, 0x44, 0x52]), // "IHDR"
    width,
    height,
    Buffer.from([0x08, 0x02, 0x00, 0x00, 0x00]) // 8-bit RGB, no compression, no filter, no interlace
  ])

  const ihdrCRC = require('crypto').createHash('crc32').update(ihdrData).digest()
  const ihdrLength = Buffer.alloc(4)
  ihdrLength.writeUInt32BE(ihdrData.length, 0)

  const ihdrChunk = Buffer.concat([ihdrLength, ihdrData, ihdrCRC])

  // IDAT chunk (简单的图像数据)
  const pixelData = Buffer.alloc(size * size * 3)
  for (let i = 0; i < pixelData.length; i += 3) {
    pixelData[i] = 59 // R: #3B
    pixelData[i + 1] = 130 // G: #82
    pixelData[i + 2] = 246 // B: #F6
  }

  const idatData = Buffer.concat([
    Buffer.from([0x49, 0x44, 0x41, 0x54]), // "IDAT"
    pixelData
  ])

  const idatCRC = require('crypto').createHash('crc32').update(idatData).digest()
  const idatLength = Buffer.alloc(4)
  idatLength.writeUInt32BE(idatData.length, 0)

  const idatChunk = Buffer.concat([idatLength, idatData, idatCRC])

  // IEND chunk
  const iendChunk = Buffer.from([
    0x00,
    0x00,
    0x00,
    0x00, // length
    0x49,
    0x45,
    0x4e,
    0x44, // "IEND"
    0xae,
    0x42,
    0x60,
    0x82 // CRC
  ])

  return Buffer.concat([pngHeader, ihdrChunk, idatChunk, iendChunk])
}

// 创建图标目录
const iconsDir = path.join(__dirname, 'icons')
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// 生成不同尺寸的图标
const sizes = [16, 48, 128]
sizes.forEach(size => {
  const iconPath = path.join(iconsDir, `icon${size}.png`)
  const iconData = createMinimalPNG(size)
  fs.writeFileSync(iconPath, iconData)
  console.log(`✅ 创建图标: ${iconPath} (${size}x${size})`)
})

console.log('\n🎉 所有图标已创建完成！')
console.log('现在你可以重新运行: npm run build:extension')
