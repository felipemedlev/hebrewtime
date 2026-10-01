import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const source = new URL("../public/brand/hebrewtales-mark.svg", import.meta.url);
const destination = new URL("../src/app/favicon.ico", import.meta.url);
const sizes = [32, 64, 256];

const svg = await readFile(source);
const images = await Promise.all(
  sizes.map((size) => sharp(svg).resize(size, size, { fit: "contain" }).png().toBuffer())
);

// ICO directory entries point to the PNG for each supported icon size.
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((image, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index] === 256 ? 0 : sizes[index];
  header[entry + 1] = header[entry];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(image.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += image.length;
});
await writeFile(destination, Buffer.concat([header, ...images]));
console.log(`Generated favicon with sizes: ${sizes.join(", ")}`);
