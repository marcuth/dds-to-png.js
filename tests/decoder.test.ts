import { describe, expect, it } from "vitest"

import { decodeDdsFile } from "../src/decoder"
import { alphaBlock, buildDds, colorBlock } from "./helpers"

const px = (data: Uint8Array, i: number) => Array.from(data.slice(i * 4, i * 4 + 4))

describe("decodeDdsFile - validation", () => {
    it("rejects files smaller than a DDS header", () => {
        expect(() => decodeDdsFile(new Uint8Array(10))).toThrow("too small")
    })

    it("rejects an invalid magic number", () => {
        expect(() => decodeDdsFile(new Uint8Array(128))).toThrow("Invalid magic")
    })

    it("rejects unknown FourCC codes", () => {
        expect(() => decodeDdsFile(buildDds({ width: 4, height: 4, fourCC: "ABCD" }))).toThrow("Unsupported FourCC code: ABCD")
    })

    it("rejects pixel formats that are neither FourCC nor RGB", () => {
        expect(() => decodeDdsFile(buildDds({ width: 4, height: 4, pfFlags: 0 }))).toThrow("Unsupported DDS pixel format")
    })

    it("rejects truncated block-compressed data", () => {
        expect(() => decodeDdsFile(buildDds({ width: 4, height: 4, fourCC: "DXT1" }, [0]))).toThrow("truncated")
    })

    it("rejects truncated uncompressed data", () => {
        const dds = buildDds({ width: 2, height: 2, pfFlags: 0x41, bitCount: 32, masks: [0xff, 0xff00, 0xff0000, 0xff000000] }, [0])
        expect(() => decodeDdsFile(dds)).toThrow("truncated")
    })

    it("rejects unsupported bit counts", () => {
        expect(() => decodeDdsFile(buildDds({ width: 1, height: 1, pfFlags: 0x40, bitCount: 16 }, [0, 0]))).toThrow("Unsupported bit count: 16")
    })

    it("rejects unsupported DXGI formats", () => {
        expect(() => decodeDdsFile(buildDds({ width: 4, height: 4, fourCC: "DX10", dxgi: 98 }))).toThrow("Unsupported DXGI format: 98")
    })
})

describe("decodeDdsFile - BC1 (DXT1)", () => {
    it("decodes 4-colour mode with exact 8-bit expansion", () => {
        const dds = buildDds({ width: 4, height: 4, fourCC: "DXT1" }, colorBlock(0xffff, 0x0000, 0b11_10_01_00))
        const { data, width, height } = decodeDdsFile(dds)

        expect([width, height]).toEqual([4, 4])
        expect(px(data, 0)).toEqual([255, 255, 255, 255])
        expect(px(data, 1)).toEqual([0, 0, 0, 255])
        expect(px(data, 2)).toEqual([170, 170, 170, 255])
        expect(px(data, 3)).toEqual([85, 85, 85, 255])
    })

    it("decodes 3-colour mode with punch-through transparency", () => {
        const dds = buildDds({ width: 4, height: 4, fourCC: "DXT1" }, colorBlock(0x0000, 0xffff, 0b11_10_01_00))
        const { data } = decodeDdsFile(dds)

        expect(px(data, 0)).toEqual([0, 0, 0, 255])
        expect(px(data, 1)).toEqual([255, 255, 255, 255])
        expect(px(data, 2)).toEqual([127, 127, 127, 255])
        expect(px(data, 3)).toEqual([0, 0, 0, 0])
    })

    it("handles dimensions that are not multiples of 4", () => {
        const block = colorBlock(0xffff, 0x0000, 0)
        const dds = buildDds({ width: 5, height: 6, fourCC: "DXT1" }, [...block, ...block, ...block, ...block])
        const { data, width, height } = decodeDdsFile(dds)

        expect([width, height]).toEqual([5, 6])
        expect(data.length).toBe(5 * 6 * 4)
        expect(px(data, 5 * 6 - 1)).toEqual([255, 255, 255, 255])
    })
})

describe("decodeDdsFile - BC2 (DXT3)", () => {
    it("decodes explicit 4-bit alpha", () => {
        const alpha = [0x0f, 0x38, 0, 0, 0, 0, 0, 0]
        const dds = buildDds({ width: 4, height: 4, fourCC: "DXT3" }, [...alpha, ...colorBlock(0xffff, 0, 0)])
        const { data } = decodeDdsFile(dds)

        expect(px(data, 0)).toEqual([255, 255, 255, 255])
        expect(px(data, 1)[3]).toBe(0)
        expect(px(data, 2)[3]).toBe(136)
        expect(px(data, 3)[3]).toBe(51)
    })

    it("does not un-premultiply DXT3", () => {
        const alpha = [0x08, 0, 0, 0, 0, 0, 0, 0]
        const dds = buildDds({ width: 4, height: 4, fourCC: "DXT3" }, [...alpha, ...colorBlock(0x7bef, 0, 0)])

        expect(px(decodeDdsFile(dds).data, 0)).toEqual([123, 125, 123, 136])
    })
})

describe("decodeDdsFile - BC3 (DXT5)", () => {
    it("decodes 8-alpha interpolation (a0 > a1) across both index halves", () => {
        const indices = [0, 1, 2, 3, 4, 5, 6, 7, 7, 6, 5, 4, 3, 2, 1, 0]
        const dds = buildDds({ width: 4, height: 4, fourCC: "DXT5" }, [...alphaBlock(255, 0, indices), ...colorBlock(0xffff, 0, 0)])
        const { data } = decodeDdsFile(dds)
        const alphas = Array.from({ length: 16 }, (_, i) => px(data, i)[3])

        expect(alphas).toEqual([255, 0, 219, 182, 146, 109, 73, 36, 36, 73, 109, 146, 182, 219, 0, 255])
    })

    it("decodes 6-alpha interpolation with explicit 0 and 255 (a0 <= a1)", () => {
        const indices = [0, 1, 2, 3, 4, 5, 6, 7, 0, 0, 0, 0, 0, 0, 0, 0]
        const dds = buildDds({ width: 4, height: 4, fourCC: "DXT5" }, [...alphaBlock(0, 100, indices), ...colorBlock(0xffff, 0, 0)])
        const { data } = decodeDdsFile(dds)
        const alphas = Array.from({ length: 8 }, (_, i) => px(data, i)[3])

        expect(alphas).toEqual([0, 100, 20, 40, 60, 80, 0, 255])
    })
})

describe("decodeDdsFile - premultiplied (DXT2/DXT4)", () => {
    it("un-premultiplies DXT4 colours, keeping alpha 0 and 255 untouched", () => {
        const indices = [0, 1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
        const dds = buildDds({ width: 4, height: 4, fourCC: "DXT4" }, [...alphaBlock(255, 0, indices), ...colorBlock(0x7bef, 0x7bef, 0)])
        const { data } = decodeDdsFile(dds)

        expect(px(data, 0)).toEqual([123, 125, 123, 255])
        expect(px(data, 1)).toEqual([123, 125, 123, 0])
        expect(px(data, 2)).toEqual([143, 146, 143, 219])
    })

    it("clamps un-premultiplied values to 255 and supports DXT2", () => {
        const alpha = [0x04, 0, 0, 0, 0, 0, 0, 0]
        const dds = buildDds({ width: 4, height: 4, fourCC: "DXT2" }, [...alpha, ...colorBlock(0xffff, 0xffff, 0)])

        expect(px(decodeDdsFile(dds).data, 0)).toEqual([255, 255, 255, 68])
    })
})

describe("decodeDdsFile - uncompressed", () => {
    const RGBA: [number, number, number, number] = [0xff, 0xff00, 0xff0000, 0xff000000]

    it("decodes 32-bit RGBA with an alpha mask", () => {
        const dds = buildDds({ width: 2, height: 1, pfFlags: 0x41, bitCount: 32, masks: RGBA }, [10, 20, 30, 40, 50, 60, 70, 80])

        expect(Array.from(decodeDdsFile(dds).data)).toEqual([10, 20, 30, 40, 50, 60, 70, 80])
    })

    it("decodes 24-bit BGR without alpha", () => {
        const dds = buildDds({ width: 1, height: 1, pfFlags: 0x40, bitCount: 24, masks: [0xff0000, 0xff00, 0xff, 0] }, [1, 2, 3])

        expect(Array.from(decodeDdsFile(dds).data)).toEqual([3, 2, 1, 255])
    })

    it("ignores the alpha mask when DDPF_ALPHAPIXELS is not set", () => {
        const dds = buildDds({ width: 1, height: 1, pfFlags: 0x40, bitCount: 32, masks: RGBA }, [1, 2, 3, 4])

        expect(Array.from(decodeDdsFile(dds).data)).toEqual([1, 2, 3, 255])
    })

    it("rescales narrow channels and handles 32-bit wide masks", () => {
        const dds = buildDds({ width: 1, height: 1, pfFlags: 0x40, bitCount: 32, masks: [0x7, 0xffffffff, 0, 0] }, [0x07, 0, 0, 0])

        expect(px(decodeDdsFile(dds).data, 0)).toEqual([255, 0, 0, 255])
    })

    it("decodes DX10 R8G8B8A8", () => {
        const dds = buildDds({ width: 1, height: 1, fourCC: "DX10", dxgi: 28 }, [1, 2, 3, 4])

        expect(Array.from(decodeDdsFile(dds).data)).toEqual([1, 2, 3, 4])
    })

    it("decodes DX10 B8G8R8A8", () => {
        const dds = buildDds({ width: 1, height: 1, fourCC: "DX10", dxgi: 87 }, [1, 2, 3, 4])

        expect(Array.from(decodeDdsFile(dds).data)).toEqual([3, 2, 1, 4])
    })
})

describe("decodeDdsFile - DX10 block formats", () => {
    it.each([
        [71, colorBlock(0xffff, 0, 0)],
        [74, [0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, ...colorBlock(0xffff, 0, 0)]],
        [77, [...alphaBlock(255, 255, []), ...colorBlock(0xffff, 0, 0)]],
    ])("decodes DXGI %i", (dxgi, body) => {
        const { data } = decodeDdsFile(buildDds({ width: 4, height: 4, fourCC: "DX10", dxgi }, body))

        expect(px(data, 0)).toEqual([255, 255, 255, 255])
    })
})

describe("decodeDdsFile - subarray input", () => {
    it("respects the byteOffset of the input view", () => {
        const dds = buildDds({ width: 1, height: 1, fourCC: "DX10", dxgi: 28 }, [9, 8, 7, 6])
        const padded = new Uint8Array(dds.length + 5)

        padded.set(dds, 5)

        expect(Array.from(decodeDdsFile(padded.subarray(5)).data)).toEqual([9, 8, 7, 6])
    })
})
