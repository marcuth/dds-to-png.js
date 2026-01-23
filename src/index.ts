import { parseHeaders, decodeDds } from "dds-parser"
import { PNG } from "pngjs"
import fs from "node:fs"

export function unpremultiplyAlpha(data: Uint8Array | Uint8ClampedArray): void {
    const len = data.length

    for (let i = 0; i < len; i += 4) {
        const a = data[i + 3]

        if (a === 0) continue

        const alpha = a / 255

        data[i] = Math.min(255, Math.round(data[i] / alpha))
        data[i + 1] = Math.min(255, Math.round(data[i + 1] / alpha))
        data[i + 2] = Math.min(255, Math.round(data[i + 2] / alpha))
    }
}

export async function convertDdsToPng(inputPath: string, outputPath: string): Promise<void> {
    if (!fs.existsSync(inputPath)) {
        throw new Error(`File not found: ${inputPath}`)
    }

    const buffer = fs.readFileSync(inputPath)

    const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    )

    const info = parseHeaders(arrayBuffer)
    const { shape, format, images } = info

    const img = images[0]

    if (!img) {
        throw new Error("No images found in the DDS archive")
    }

    const sliceStart = img.offset
    const sliceEnd = img.offset + img.length
    const pixelArray = arrayBuffer.slice(sliceStart, sliceEnd)

    const rgba = decodeDds(
        new Uint8Array(pixelArray),
        format,
        shape.width,
        shape.height
    )

    unpremultiplyAlpha(rgba)

    const png = new PNG({ width: shape.width, height: shape.height })

    png.data.set(new Uint8Array(rgba))

    await new Promise<void>((resolve, reject) => {
        png
            .pack()
            .pipe(fs.createWriteStream(outputPath))
            .on("error", reject)
            .on("finish", resolve)
    })
}