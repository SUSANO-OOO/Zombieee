import sharp from "sharp";

function studioCandidate(red, green, blue) {
  const darkest = Math.min(red, green, blue);
  const lightest = Math.max(red, green, blue);
  return darkest >= 205 && lightest - darkest <= 35;
}

export async function studioIdentityCutout(inputPath) {
  const decoded = await sharp(inputPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = decoded.info;
  const pixelCount = width * height;
  const background = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;
  const enqueue = (pixel) => {
    if (background[pixel]) return;
    const channel = pixel * 3;
    if (!studioCandidate(decoded.data[channel], decoded.data[channel + 1], decoded.data[channel + 2])) return;
    background[pixel] = 1;
    queue[tail++] = pixel;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) enqueue(pixel - 1);
    if (x + 1 < width) enqueue(pixel + 1);
    if (y > 0) enqueue(pixel - width);
    if (y + 1 < height) enqueue(pixel + width);
  }
  const rgba = Buffer.alloc(pixelCount * 4);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const source = pixel * 3;
    const target = pixel * 4;
    const red = decoded.data[source];
    const green = decoded.data[source + 1];
    const blue = decoded.data[source + 2];
    rgba[target] = red;
    rgba[target + 1] = green;
    rgba[target + 2] = blue;
    rgba[target + 3] = background[pixel] ? 0 : 255;
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } })
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 2 })
    .png()
    .toBuffer();
}

async function upperSubject(cutout, ratio) {
  const metadata = await sharp(cutout).metadata();
  const height = Math.max(1, Math.min(metadata.height, Math.round(metadata.height * ratio)));
  return sharp(cutout)
    .extract({ left: 0, top: 0, width: metadata.width, height })
    .png()
    .toBuffer();
}

export async function buildIdentityPortrait({
  inputPath,
  outputPath,
  upperRatio = .78,
}) {
  const cutout = await studioIdentityCutout(inputPath);
  const upper = await upperSubject(cutout, upperRatio);
  const subject = await sharp(upper)
    .resize({ width: 500, height: 624, fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const metadata = await sharp(subject).metadata();
  await sharp({
    create: {
      width: 512,
      height: 640,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{
      input: subject,
      left: Math.round((512 - metadata.width) / 2),
      top: 640 - metadata.height,
    }])
    .webp({ quality: 94, alphaQuality: 100, effort: 6 })
    .toFile(outputPath);
}

export async function buildFormationCard({
  inputPath,
  outputPath,
  accent,
  roleLabel,
  motif,
  upperRatio = .74,
}) {
  const cutout = await studioIdentityCutout(inputPath);
  const upper = await upperSubject(cutout, upperRatio);
  const subject = await sharp(upper)
    .resize({ width: 500, height: 500, fit: "inside", kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
  const metadata = await sharp(subject).metadata();
  const overlay = Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
      <defs>
        <linearGradient id="shade" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#101718" stop-opacity=".08"/>
          <stop offset=".62" stop-color="#090d12" stop-opacity=".18"/>
          <stop offset="1" stop-color="#090d12" stop-opacity=".7"/>
        </linearGradient>
      </defs>
      <rect width="512" height="512" fill="url(#shade)"/>
      <rect x="16" y="16" width="10" height="480" rx="5" fill="${accent}"/>
      <path d="M292 330h204v166H264l28-166z" fill="#090d12" fill-opacity=".92" stroke="${accent}" stroke-width="5"/>
      ${motif}
      <text x="474" y="480" text-anchor="end" font-family="Arial,sans-serif" font-weight="900" font-size="22" letter-spacing="1.5" fill="#fff">${roleLabel}</text>
    </svg>
  `);
  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: subject,
        left: Math.round((512 - metadata.width) / 2),
        top: Math.max(0, 512 - metadata.height),
      },
      { input: overlay },
    ])
    .webp({ quality: 93, alphaQuality: 100, effort: 6 })
    .toFile(outputPath);
}
