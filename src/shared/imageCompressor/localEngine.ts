import type { ImageCompressorLocalOptions } from '@shared/types'
import {
  type CompressEngine,
  type CompressFormat,
  type CompressInput,
  type CompressOptions,
  type CompressResult,
  formatExtension,
  inferFormatFromMime,
  replaceExtension,
} from './engine'

/**
 * 本地 WASM 压缩引擎：优先使用 @jsquash 系列对 PNG/JPEG/WebP 做高质量压缩；
 * 其它格式（GIF/BMP/AVIF 输入等）或 WASM 加载失败时回退到 Canvas API。
 */
export const localEngine: CompressEngine = {
  id: 'local',
  async compress(input: CompressInput, options: CompressOptions): Promise<CompressResult> {
    const local = options.local
    const sourceFormat = inferFormatFromMime(input.blob.type)
    const beforeBytes = input.blob.size

    // 仅 PNG/JPEG/WebP 走 WASM 路径；其它格式直接走 Canvas 兜底
    if (sourceFormat == 'image/png' || sourceFormat == 'image/jpeg' || sourceFormat == 'image/webp') {
      try {
        const buffer = await input.blob.arrayBuffer()
        const imageData = await decodeToImageData(buffer, sourceFormat)
        const resized = resizeImageData(imageData, local.maxEdge)
        let encoded = await encodeFromImageData(resized, sourceFormat, local)

        // 对 PNG 额外走 oxipng 无损优化；level > 0 才执行
        if (sourceFormat == 'image/png' && local.pngOptimizeLevel > 0) {
          const { default: optimise } = await import('@jsquash/oxipng/optimise')
          encoded = await optimise(encoded, {
            level: Math.min(6, Math.max(1, local.pngOptimizeLevel)),
            interlace: false,
            optimiseAlpha: true,
          })
        }

        const blob = new Blob([encoded], { type: sourceFormat })
        const ext = formatExtension(sourceFormat)
        return {
          blob,
          type: sourceFormat,
          name: replaceExtension(input.name || 'image', ext),
          beforeBytes,
          afterBytes: blob.size,
        }
      } catch (error) {
        console.warn('[ImageCompressor] WASM 压缩失败,回退到 Canvas:', error)
      }
    }

    // Canvas 兜底：保持原格式或回退到 image/png
    const fallbackFormat: CompressFormat = sourceFormat ?? 'image/png'
    const quality = fallbackFormat == 'image/png' ? 1 : local.jpegQuality / 100
    const blob = await canvasCompress(input.blob, fallbackFormat, quality, local.maxEdge)
    const ext = formatExtension(fallbackFormat)
    return {
      blob,
      type: fallbackFormat,
      name: replaceExtension(input.name || 'image', ext),
      beforeBytes,
      afterBytes: blob.size,
    }
  },
}

async function decodeToImageData(buffer: ArrayBuffer, format: CompressFormat): Promise<ImageData> {
  if (format == 'image/png') {
    const { decode } = await import('@jsquash/png')
    return decode(buffer)
  }
  if (format == 'image/jpeg') {
    const { decode } = await import('@jsquash/jpeg')
    return decode(buffer)
  }
  const { decode } = await import('@jsquash/webp')
  return decode(buffer)
}

async function encodeFromImageData(
  imageData: ImageData,
  format: CompressFormat,
  options: ImageCompressorLocalOptions
): Promise<ArrayBuffer> {
  if (format == 'image/png') {
    const { encode } = await import('@jsquash/png')
    return encode(imageData)
  }
  if (format == 'image/jpeg') {
    const { encode } = await import('@jsquash/jpeg')
    return encode(imageData, { quality: options.jpegQuality })
  }
  const { encode } = await import('@jsquash/webp')
  return encode(imageData, { quality: options.webpQuality })
}

function resizeImageData(src: ImageData, maxEdge: number): ImageData {
  if (!maxEdge || maxEdge <= 0) return src
  const longest = Math.max(src.width, src.height)
  if (longest <= maxEdge) return src
  const ratio = maxEdge / longest
  const targetW = Math.max(1, Math.round(src.width * ratio))
  const targetH = Math.max(1, Math.round(src.height * ratio))

  // 同步 Canvas 缩放；OffscreenCanvas 在主线程可用
  const canvas = typeof OffscreenCanvas != 'undefined'
    ? new OffscreenCanvas(targetW, targetH)
    : Object.assign(document.createElement('canvas'), { width: targetW, height: targetH })
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  if (!ctx) return src

  // 把 ImageData 先贴到一个临时 canvas,再缩放绘制
  const tempCanvas = typeof OffscreenCanvas != 'undefined'
    ? new OffscreenCanvas(src.width, src.height)
    : Object.assign(document.createElement('canvas'), { width: src.width, height: src.height })
  const tempCtx = tempCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  if (!tempCtx) return src
  tempCtx.putImageData(src, 0, 0)
  ctx.drawImage(tempCanvas as CanvasImageSource, 0, 0, targetW, targetH)
  return ctx.getImageData(0, 0, targetW, targetH)
}

async function canvasCompress(
  blob: Blob,
  format: CompressFormat,
  quality: number,
  maxEdge: number
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob)
  const ratio = maxEdge > 0 ? Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height)) : 1
  const targetW = Math.max(1, Math.round(bitmap.width * ratio))
  const targetH = Math.max(1, Math.round(bitmap.height * ratio))
  const canvas = typeof OffscreenCanvas != 'undefined'
    ? new OffscreenCanvas(targetW, targetH)
    : Object.assign(document.createElement('canvas'), { width: targetW, height: targetH })
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  if (!ctx) throw new Error('无法创建 Canvas 上下文用于压缩')
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)
  bitmap.close()
  if (canvas instanceof HTMLCanvasElement) {
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        out => out ? resolve(out) : reject(new Error('Canvas toBlob 失败')),
        format,
        format == 'image/png' ? undefined : quality,
      )
    })
  }
  const offscreen = canvas as OffscreenCanvas
  return offscreen.convertToBlob({
    type: format,
    quality: format == 'image/png' ? undefined : quality,
  })
}