# 📦 @marcuth/dds-to-png

Convert DDS (DirectDraw Surface) texture files to PNG images in Node.js — **without ImageMagick**.

---

## 🔍 Overview

`@marcuth/dds-to-png` is a lightweight Node.js library that converts DDS texture files into PNG images (RGBA).
It uses a built-in pure JavaScript decoder that reads DDS headers and pixel data directly, with no runtime dependency besides `pngjs`.

✨ No native dependencies
✨ Works with common DDS formats (DXT1–DXT5, uncompressed RGB/RGBA, DX10 BC1/BC2/BC3)
✨ Accurate alpha handling: exact 8-bit colour expansion, DXT1 punch-through transparency, DXT2/DXT4 premultiplied alpha, no blur applied to edges
✨ Promise-based API
✨ Simple to integrate in scripts and build pipelines

---

## 📦 Installation

Install with npm:

```bash
npm install @marcuth/dds-to-png
```

---

## 🚀 Usage

```js
import { convertDdsToPng } from "@marcuth/dds-to-png"

async function run() {
    try {
        await convertDdsToPng("input.dds", "output.png")
        console.log("Conversion completed successfully!")
    } catch (error) {
        console.error("Error converting DDS:", error)
    }
}

run()
```

---

## 📌 API

### `convertDdsToPng(inputPath: string, outputPath: string): Promise<void>`

Converts a `.dds` file into a `.png` file.

| Parameter    | Type     | Description                    |
| ------------ | -------- | ------------------------------ |
| `inputPath`  | `string` | Path to the source DDS file    |
| `outputPath` | `string` | Target path for the output PNG |

**Returns:**
A `Promise<void>` that resolves when the PNG file has been successfully written.

**Throws:**

* If the input file does not exist
* If the file is not a valid DDS, uses an unsupported format, or has truncated pixel data

---

## 🛠 Supported DDS Formats

This library currently supports the most common DDS compression formats:

✔️ DXT1 (BC1), including 1-bit transparency
✔️ DXT2 / DXT3 (BC2)
✔️ DXT4 / DXT5 (BC3)
✔️ Uncompressed 24/32-bit RGB(A), with arbitrary channel masks
✔️ DX10 header with BC1, BC2, BC3, R8G8B8A8 and B8G8R8A8
✔️ Any width/height, including sizes that are not multiples of 4

DXT2 and DXT4 use premultiplied alpha; the output PNG always contains straight (non-premultiplied) alpha.

Other formats (e.g., BC7, ASTC, cubemaps, texture arrays) are **not supported** at this time.

---

## 💡 Notes

* The conversion always uses the **first image** (mipmap level 0).
* If your DDS contains multiple textures or layers, custom handling will be required.
* This is intended for **Node.js environments** and not browser use.

---

## 🧪 Testing

Tests are written with [Vitest](https://vitest.dev) and enforce 100% coverage (statements, branches, functions and lines).

```bash
npm test
npm run coverage
```

---

## 🧠 Contributing

Contributions are welcome!
Feel free to open issues or pull requests for new features, format support, or bug fixes.

---

## 📜 License

MIT © Marcuth