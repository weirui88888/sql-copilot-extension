const fs = require('fs');
const path = require('path');

// 创建简单的纯色PNG图标
function createSimplePNG(size, color = [59, 130, 246]) {
    // PNG文件头
    const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    
    // IHDR chunk - 图像头信息
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(size, 0);      // 宽度
    ihdrData.writeUInt32BE(size, 4);      // 高度
    ihdrData[8] = 8;                      // 位深度
    ihdrData[9] = 2;                      // 颜色类型 (RGB)
    ihdrData[10] = 0;                     // 压缩方法
    ihdrData[11] = 0;                     // 过滤方法
    ihdrData[12] = 0;                     // 交错方法
    
    const ihdrChunk = createChunk('IHDR', ihdrData);
    
    // IDAT chunk - 图像数据
    const pixelData = Buffer.alloc(size * size * 3);
    for (let i = 0; i < pixelData.length; i += 3) {
        pixelData[i] = color[0];     // R
        pixelData[i + 1] = color[1]; // G
        pixelData[i + 2] = color[2]; // B
    }
    
    const idatChunk = createChunk('IDAT', pixelData);
    
    // IEND chunk - 图像结束
    const iendChunk = Buffer.from([
        0x00, 0x00, 0x00, 0x00, // 长度
        0x49, 0x45, 0x4E, 0x44, // "IEND"
        0xAE, 0x42, 0x60, 0x82  // CRC
    ]);
    
    return Buffer.concat([pngSignature, ihdrChunk, idatChunk, iendChunk]);
}

// 创建PNG chunk
function createChunk(type, data) {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length, 0);
    
    const typeBuffer = Buffer.from(type);
    const crc = require('crypto').createHash('crc32').update(Buffer.concat([typeBuffer, data])).digest();
    
    return Buffer.concat([length, typeBuffer, data, crc]);
}

// 确保icons目录存在
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// 生成图标
const sizes = [16, 48, 128];
const colors = [
    [59, 130, 246],   // 蓝色
    [16, 185, 129],   // 绿色
    [245, 158, 11]    // 黄色
];

sizes.forEach((size, index) => {
    const iconPath = path.join(iconsDir, `icon${size}.png`);
    const iconData = createSimplePNG(size, colors[index % colors.length]);
    fs.writeFileSync(iconPath, iconData);
    console.log(`✅ 创建图标: ${iconPath} (${size}x${size})`);
});

console.log('\n🎉 所有图标已创建完成！');
console.log('现在你可以重新运行: npm run build:extension');
