import { parseHeaders, decodeDds } from "dds-parser"
import { PNG } from "pngjs"
import fs from "node:fs"

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