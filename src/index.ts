import fs from "node:fs"
import { PNG } from "pngjs"

import { decodeDdsFile } from "./decoder"

export async function convertDdsToPng(inputPath: string, outputPath: string): Promise<void> {
    if (!fs.existsSync(inputPath)) {
        throw new Error(`File not found: ${inputPath}`)
    }

    const { width, height, data } = decodeDdsFile(fs.readFileSync(inputPath))

    const png = new PNG({ width, height })

    png.data.set(data)

    await new Promise<void>((resolve, reject) => {
        png.pack().pipe(fs.createWriteStream(outputPath)).on("error", reject).on("finish", resolve)
    })
}
