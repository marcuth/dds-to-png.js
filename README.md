# 📦 @marcuth/dds-to-png

Convert DDS (DirectDraw Surface) texture files to PNG images in Node.js — **without ImageMagick**.

---

## 🔍 Overview

`@marcuth/dds-to-png` is a lightweight Node.js library that converts DDS texture files into PNG images (RGBA).
It uses pure JavaScript and works directly with DDS headers + pixel data using `dds-parser`.

✨ No native dependencies
✨ Works with common DDS formats (DXT1, DXT3, DXT5)
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
* If no image data is found inside the DDS file

---

## 🛠 Supported DDS Formats

This library currently supports the most common DDS compression formats:

✔️ DXT1
✔️ DXT3
✔️ DXT5
✔️ Uncompressed RGBA

Other formats (e.g., BC7, ASTC, cubemaps, texture arrays) are **not supported** at this time.

---

## 💡 Notes

* The conversion always uses the **first image** (mipmap level 0).
* If your DDS contains multiple textures or layers, custom handling will be required.
* This is intended for **Node.js environments** and not browser use.

---

## 🚫 No Testing Included

This library currently does **not ship with built-in tests**. Users may add their own testing setup if desired.

---

## 🧠 Contributing

Contributions are welcome!
Feel free to open issues or pull requests for new features, format support, or bug fixes.

---

## 📜 License

MIT © Marcuth