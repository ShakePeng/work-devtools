/**
 * 从 icon.svg 生成 Chrome 扩展所需的 16/48/128 三种尺寸 PNG 图标
 */
import sharp from 'sharp'
import { readFile, mkdir } from 'fs/promises'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath = resolve(__dirname, 'icon.svg')
const outDir = resolve(__dirname, '../public')

const svg = await readFile(svgPath)
await mkdir(outDir, { recursive: true })

const sizes = [16, 48, 128]
for (const size of sizes) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(resolve(outDir, `icon-${size}.png`))
  console.log(`✅ 生成 icon-${size}.png`)
}

console.log('🎉 图标生成完成')
