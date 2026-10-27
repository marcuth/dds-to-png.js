import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { PNG } from "pngjs"

import { convertDdsToPng } from "../src"
import { buildDds, colorBlock } from "./helpers"

describe("convertDdsToPng", () => {
    let dir: string

    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "dds-to-png-"))
    })

    afterEach(() => {
        fs.rmSync(dir, { recursive: true, force: true })
    })

    it("converts a DDS file into a PNG preserving transparency", async () => {
        const input = path.join(dir, "in.dds")
        const output = path.join(dir, "out.png")

        fs.writeFileSync(input, buildDds({ width: 4, height: 4, fourCC: "DXT1" }, colorBlock(0x0000, 0xffff, 0b11_00_01_00)))

        await convertDdsToPng(input, output)

        const png = PNG.sync.read(fs.readFileSync(output))

        expect([png.width, png.height]).toEqual([4, 4])
        expect(Array.from(png.data.slice(0, 4))).toEqual([0, 0, 0, 255])
        expect(Array.from(png.data.slice(4, 8))).toEqual([255, 255, 255, 255])
        expect(png.data[15]).toBe(0)
    })

    it("throws when the input file does not exist", async () => {
        await expect(convertDdsToPng(path.join(dir, "missing.dds"), path.join(dir, "o.png"))).rejects.toThrow("File not found")
    })

    it("rejects when the output cannot be written", async () => {
        const input = path.join(dir, "in.dds")

        fs.writeFileSync(input, buildDds({ width: 4, height: 4, fourCC: "DXT1" }, colorBlock(0xffff, 0, 0)))

        await expect(convertDdsToPng(input, path.join(dir, "no-such-dir", "o.png"))).rejects.toThrow()
    })
})
