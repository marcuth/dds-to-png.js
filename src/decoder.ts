export type DdsFormat = "dxt1" | "dxt2" | "dxt3" | "dxt4" | "dxt5" | "rgba"

export interface DdsImage {
    width: number
    height: number
    data: Uint8Array
}

const DDS_MAGIC = 0x20534444
const DDPF_ALPHAPIXELS = 0x1
const DDPF_FOURCC = 0x4
const DDPF_RGB = 0x40

const fourCC = (value: string) =>
    value.charCodeAt(0) | (value.charCodeAt(1) << 8) | (value.charCodeAt(2) << 16) | (value.charCodeAt(3) << 24)

const FOURCC_FORMATS = new Map<number, DdsFormat>([
    [fourCC("DXT1"), "dxt1"],
    [fourCC("DXT2"), "dxt2"],
    [fourCC("DXT3"), "dxt3"],
    [fourCC("DXT4"), "dxt4"],
    [fourCC("DXT5"), "dxt5"],
])

const FOURCC_DX10 = fourCC("DX10")

const DXGI_FORMATS = new Map<number, DdsFormat>([
    [71, "dxt1"], [72, "dxt1"],
    [74, "dxt3"], [75, "dxt3"],
    [77, "dxt5"], [78, "dxt5"],
])

const DXGI_RGBA8 = new Set([28, 29])
const DXGI_BGRA8 = new Set([87, 91])

const expand5 = (v: number) => (v << 3) | (v >> 2)
const expand6 = (v: number) => (v << 2) | (v >> 4)

function buildPalette(palette: Uint8Array, c0: number, c1: number, allowPunchThrough: boolean): void {
    const r0 = expand5((c0 >> 11) & 31), g0 = expand6((c0 >> 5) & 63), b0 = expand5(c0 & 31)
    const r1 = expand5((c1 >> 11) & 31), g1 = expand6((c1 >> 5) & 63), b1 = expand5(c1 & 31)

    palette.set([r0, g0, b0, 255, r1, g1, b1, 255])

    if (c0 > c1 || !allowPunchThrough) {
        palette.set([
            Math.round((2 * r0 + r1) / 3), Math.round((2 * g0 + g1) / 3), Math.round((2 * b0 + b1) / 3), 255,
            Math.round((r0 + 2 * r1) / 3), Math.round((g0 + 2 * g1) / 3), Math.round((b0 + 2 * b1) / 3), 255,
        ], 8)
    } else {
        palette.set([
            (r0 + r1) >> 1, (g0 + g1) >> 1, (b0 + b1) >> 1, 255,
            0, 0, 0, 0,
        ], 8)
    }
}

function buildAlphaPalette(palette: Uint8Array, a0: number, a1: number): void {
    palette[0] = a0
    palette[1] = a1

    if (a0 > a1) {
        for (let i = 1; i <= 6; i++) {
            palette[i + 1] = Math.round(((7 - i) * a0 + i * a1) / 7)
        }
    } else {
        for (let i = 1; i <= 4; i++) {
            palette[i + 1] = Math.round(((5 - i) * a0 + i * a1) / 5)
        }

        palette[6] = 0
        palette[7] = 255
    }
}

function decodeBlockCompressed(src: Uint8Array, width: number, height: number, format: DdsFormat): Uint8Array {
    const bw = Math.ceil(width / 4)
    const bh = Math.ceil(height / 4)
    const blockSize = format === "dxt1" ? 8 : 16
    const isBc1 = format === "dxt1"
    const isBc3 = format === "dxt4" || format === "dxt5"
    const premultiplied = format === "dxt2" || format === "dxt4"

    if (src.length < bw * bh * blockSize) {
        throw new Error("DDS pixel data is truncated")
    }

    const out = new Uint8Array(width * height * 4)
    const palette = new Uint8Array(16)
    const alphaPalette = new Uint8Array(8)

    for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
            const o = (by * bw + bx) * blockSize
            const colorOffset = isBc1 ? o : o + 8

            buildPalette(
                palette,
                src[colorOffset] | (src[colorOffset + 1] << 8),
                src[colorOffset + 2] | (src[colorOffset + 3] << 8),
                isBc1
            )

            const colorBits = (src[colorOffset + 4] | (src[colorOffset + 5] << 8) | (src[colorOffset + 6] << 16) | (src[colorOffset + 7] << 24)) >>> 0

            let alphaLow = 0
            let alphaHigh = 0

            if (isBc3) {
                buildAlphaPalette(alphaPalette, src[o], src[o + 1])

                alphaLow = src[o + 2] | (src[o + 3] << 8) | (src[o + 4] << 16)
                alphaHigh = src[o + 5] | (src[o + 6] << 8) | (src[o + 7] << 16)
            }

            for (let py = 0; py < 4; py++) {
                const y = by * 4 + py
                if (y >= height) break

                for (let px = 0; px < 4; px++) {
                    const x = bx * 4 + px
                    if (x >= width) break

                    const p = py * 4 + px
                    const c = ((colorBits >>> (p * 2)) & 3) * 4
                    const dst = (y * width + x) * 4

                    out[dst] = palette[c]
                    out[dst + 1] = palette[c + 1]
                    out[dst + 2] = palette[c + 2]

                    if (isBc1) {
                        out[dst + 3] = palette[c + 3]
                    } else if (isBc3) {
                        out[dst + 3] = alphaPalette[((p < 8 ? alphaLow : alphaHigh) >> ((p & 7) * 3)) & 7]
                    } else {
                        const byte = src[o + (p >> 1)]
                        const nibble = p & 1 ? byte >> 4 : byte & 0xf
                        out[dst + 3] = nibble * 17
                    }
                }
            }
        }
    }

    if (premultiplied) {
        unpremultiply(out)
    }

    return out
}

function unpremultiply(data: Uint8Array): void {
    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]
        if (a === 0 || a === 255) continue

        data[i] = Math.min(255, Math.round((data[i] * 255) / a))
        data[i + 1] = Math.min(255, Math.round((data[i + 1] * 255) / a))
        data[i + 2] = Math.min(255, Math.round((data[i + 2] * 255) / a))
    }
}

function decodeUncompressed(
    src: Uint8Array,
    width: number,
    height: number,
    bitCount: number,
    masks: { r: number, g: number, b: number, a: number }
): Uint8Array {
    const bytes = bitCount / 8
    if (src.length < width * height * bytes) {
        throw new Error("DDS pixel data is truncated")
    }

    const extract = (mask: number): { shift: number, max: number } => {
        if (!mask) return { shift: 0, max: 0 }
        let shift = 0
        while (!((mask >>> shift) & 1)) shift++
        let bits = 0
        while (shift + bits < 32 && (mask >>> (shift + bits)) & 1) bits++
        return { shift, max: bits === 32 ? 0xffffffff : (1 << bits) - 1 }
    }

    const channels = [extract(masks.r), extract(masks.g), extract(masks.b), extract(masks.a)]
    const maskList = [masks.r, masks.g, masks.b, masks.a]
    const out = new Uint8Array(width * height * 4)

    for (let i = 0; i < width * height; i++) {
        let value = 0
        for (let b = 0; b < bytes; b++) value |= src[i * bytes + b] << (8 * b)
        value >>>= 0

        for (let c = 0; c < 4; c++) {
            const { shift, max } = channels[c]
            out[i * 4 + c] = maskList[c]
                ? Math.round((((value & maskList[c]) >>> shift) * 255) / max)
                : c === 3 ? 255 : 0
        }
    }

    return out
}

export function decodeDdsFile(buffer: Uint8Array): DdsImage {
    if (buffer.length < 128) {
        throw new Error("File is too small to be a DDS")
    }

    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)

    if (view.getUint32(0, true) !== DDS_MAGIC) {
        throw new Error("Invalid magic number in DDS header")
    }

    const height = view.getUint32(12, true)
    const width = view.getUint32(16, true)
    const pfFlags = view.getUint32(80, true)
    const pfFourCC = view.getInt32(84, true)
    const bitCount = view.getUint32(88, true)

    let offset = 4 + view.getUint32(4, true)
    let format: DdsFormat | undefined
    let bgra = false

    if (pfFlags & DDPF_FOURCC) {
        if (pfFourCC === FOURCC_DX10) {
            const dxgi = view.getUint32(offset, true)
            offset += 20
            format = DXGI_FORMATS.get(dxgi)

            if (!format && (DXGI_RGBA8.has(dxgi) || DXGI_BGRA8.has(dxgi))) {
                format = "rgba"
                bgra = DXGI_BGRA8.has(dxgi)
            }

            if (!format) throw new Error(`Unsupported DXGI format: ${dxgi}`)
        } else {
            format = FOURCC_FORMATS.get(pfFourCC)
            if (!format) throw new Error(`Unsupported FourCC code: ${String.fromCharCode(pfFourCC & 255, (pfFourCC >> 8) & 255, (pfFourCC >> 16) & 255, (pfFourCC >>> 24) & 255)}`)
        }
    } else if (pfFlags & DDPF_RGB) {
        format = "rgba"
    } else {
        throw new Error("Unsupported DDS pixel format")
    }

    const pixels = buffer.subarray(offset)

    if (format !== "rgba") {
        return { width, height, data: decodeBlockCompressed(pixels, width, height, format) }
    }

    const masks = (pfFlags & DDPF_FOURCC)
        ? bgra
            ? { r: 0xff0000, g: 0xff00, b: 0xff, a: 0xff000000 }
            : { r: 0xff, g: 0xff00, b: 0xff0000, a: 0xff000000 }
        : {
            r: view.getUint32(92, true),
            g: view.getUint32(96, true),
            b: view.getUint32(100, true),
            a: (pfFlags & DDPF_ALPHAPIXELS) ? view.getUint32(104, true) : 0,
        }

    const bits = (pfFlags & DDPF_FOURCC) ? 32 : bitCount

    if (bits !== 24 && bits !== 32) {
        throw new Error(`Unsupported bit count: ${bits}`)
    }

    return { width, height, data: decodeUncompressed(pixels, width, height, bits, masks) }
}
