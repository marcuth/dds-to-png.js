export interface HeaderOptions {
    width: number
    height: number
    pfFlags?: number
    fourCC?: string
    bitCount?: number
    masks?: [number, number, number, number]
    dxgi?: number
}

export function buildDds(options: HeaderOptions, body: Uint8Array | number[] = []): Uint8Array {
    const dx10 = options.fourCC === "DX10"
    const header = Buffer.alloc(128 + (dx10 ? 20 : 0))

    header.writeUInt32LE(0x20534444, 0)
    header.writeUInt32LE(124, 4)
    header.writeUInt32LE(options.height, 12)
    header.writeUInt32LE(options.width, 16)
    header.writeUInt32LE(options.pfFlags ?? 0x4, 80)

    if (options.fourCC) {
        header.write(options.fourCC, 84, "ascii")
    }

    header.writeUInt32LE(options.bitCount ?? 0, 88)

    const [r, g, b, a] = options.masks ?? [0, 0, 0, 0]
    header.writeUInt32LE(r, 92)
    header.writeUInt32LE(g, 96)
    header.writeUInt32LE(b, 100)
    header.writeUInt32LE(a, 104)

    if (dx10) {
        header.writeUInt32LE(options.dxgi ?? 0, 128)
    }

    return new Uint8Array(Buffer.concat([header, Buffer.from(body)]))
}

export function colorBlock(c0: number, c1: number, indices: number): number[] {
    const block = Buffer.alloc(8)

    block.writeUInt16LE(c0, 0)
    block.writeUInt16LE(c1, 2)
    block.writeUInt32LE(indices >>> 0, 4)

    return [...block]
}

export function alphaBlock(a0: number, a1: number, indices: number[]): number[] {
    const bytes = new Array<number>(6).fill(0)

    indices.forEach((value, i) => {
        for (let bit = 0; bit < 3; bit++) {
            if ((value >> bit) & 1) {
                const position = i * 3 + bit
                bytes[position >> 3] |= 1 << (position & 7)
            }
        }
    })

    return [a0, a1, ...bytes]
}
