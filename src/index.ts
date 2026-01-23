import { parseHeaders, decodeDds } from "dds-parser"
import { PNG } from "pngjs"
import fs from "node:fs"

function smoothDXT5Artifacts(data: Uint8Array, width: number, height: number): void {
    const temp = new Uint8Array(data)
    
    const getPixel = (x: number, y: number, channel: number): number => {
        if (x < 0 || x >= width || y < 0 || y >= height) return 0
        return temp[(y * width + x) * 4 + channel]
    }
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4
            const alpha = temp[idx + 3]
            
            if (alpha > 0 && alpha < 255) {
                const kernel = [
                    [1, 2, 1],
                    [2, 4, 2],
                    [1, 2, 1]
                ]

                const kernelSum = 16
                
                for (let c = 0; c < 4; c++) {
                    let sum = 0
                    
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const weight = kernel[ky + 1][kx + 1]
                            sum += getPixel(x + kx, y + ky, c) * weight
                        }
                    }
                    
                    data[idx + c] = Math.round(sum / kernelSum)
                }
            }
        }
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

    smoothDXT5Artifacts(rgba, shape.width, shape.height)

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