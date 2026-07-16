const PNG_SIGNATURE = Object.freeze([137, 80, 78, 71, 13, 10, 26, 10]);

export const IMAGE_FORMATS = Object.freeze({
  jpeg: Object.freeze({ mimeType: 'image/jpeg', extensions: Object.freeze(['jpg', 'jpeg']), label: 'JPEG' }),
  png: Object.freeze({ mimeType: 'image/png', extensions: Object.freeze(['png']), label: 'PNG' }),
  webp: Object.freeze({ mimeType: 'image/webp', extensions: Object.freeze(['webp']), label: 'WebP' }),
});

const JPEG_START_OF_FRAME = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

export function inspectImageBytes(input) {
  const bytes = toBytes(input);
  const format = detectImageFormat(bytes);
  const base = {
    sizeBytes: bytes.byteLength,
    format,
    mimeType: format ? IMAGE_FORMATS[format].mimeType : null,
    width: null,
    height: null,
    aspectRatio: null,
    aspectRatioLabel: null,
    orientation: orientationDetails(null),
    integrity: { valid: false, code: 'INVALID_IMAGE_SIGNATURE', message: 'A assinatura binária não corresponde a JPEG, PNG ou WebP.' },
  };

  if (!format) return base;

  const parsed = format === 'png'
    ? inspectPng(bytes)
    : format === 'jpeg'
      ? inspectJpeg(bytes)
      : inspectWebp(bytes);

  const width = parsed.width ?? null;
  const height = parsed.height ?? null;
  return {
    ...base,
    ...parsed,
    format,
    mimeType: IMAGE_FORMATS[format].mimeType,
    width,
    height,
    aspectRatio: width && height ? width / height : null,
    aspectRatioLabel: width && height ? `${width}:${height}` : null,
    orientation: orientationDetails(parsed.orientationValue ?? null),
  };
}

export function detectImageFormat(input) {
  const bytes = toBytes(input);
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'webp';
  return null;
}

export function getFormatDetails(format) {
  return IMAGE_FORMATS[format] || null;
}

export function getFileExtension(filename = '') {
  const name = String(filename).trim().toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot > -1 && dot < name.length - 1 ? name.slice(dot + 1) : null;
}

function inspectPng(bytes) {
  if (bytes.length < 33) return invalidIntegrity('TRUNCATED_IMAGE', 'O arquivo PNG está truncado.');

  const view = dataView(bytes);
  let offset = 8;
  let width = null;
  let height = null;
  let orientationValue = null;
  let sawHeader = false;
  let sawImageData = false;
  let sawEnd = false;

  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset, false);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (dataEnd < dataStart || chunkEnd > bytes.length) {
      return invalidIntegrity('TRUNCATED_IMAGE', 'O arquivo PNG termina no meio de um bloco de dados.', { width, height, orientationValue });
    }

    const type = ascii(bytes, typeStart, typeStart + 4);
    const expectedCrc = view.getUint32(dataEnd, false);
    const actualCrc = crc32(bytes, typeStart, dataEnd);
    if (expectedCrc !== actualCrc) {
      return invalidIntegrity('CORRUPT_IMAGE', `O bloco ${type || 'desconhecido'} do PNG falhou na verificação de integridade.`, { width, height, orientationValue });
    }

    if (!sawHeader && type !== 'IHDR') {
      return invalidIntegrity('CORRUPT_IMAGE', 'O PNG não começa com um cabeçalho IHDR válido.');
    }

    if (type === 'IHDR') {
      if (sawHeader || length !== 13) return invalidIntegrity('CORRUPT_IMAGE', 'O cabeçalho do PNG é inválido.');
      width = view.getUint32(dataStart, false);
      height = view.getUint32(dataStart + 4, false);
      sawHeader = true;
    } else if (type === 'IDAT') {
      sawImageData = true;
    } else if (type === 'eXIf') {
      orientationValue = readExifOrientation(bytes.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      if (length !== 0) return invalidIntegrity('CORRUPT_IMAGE', 'O final do PNG é inválido.', { width, height, orientationValue });
      sawEnd = true;
      offset = chunkEnd;
      break;
    }

    offset = chunkEnd;
  }

  if (!sawHeader || !validDimensions(width, height)) return invalidIntegrity('INVALID_DIMENSIONS', 'Não foi possível validar as dimensões do PNG.');
  if (!sawImageData || !sawEnd) return invalidIntegrity('TRUNCATED_IMAGE', 'O PNG não contém todos os blocos obrigatórios.', { width, height, orientationValue });
  if (offset !== bytes.length) return invalidIntegrity('CORRUPT_IMAGE', 'O PNG contém dados inesperados após o bloco final.', { width, height, orientationValue });

  return validIntegrity({ width, height, orientationValue });
}

function inspectJpeg(bytes) {
  if (bytes.length < 10) return invalidIntegrity('TRUNCATED_IMAGE', 'O arquivo JPEG está truncado.');

  const view = dataView(bytes);
  let offset = 2;
  let width = null;
  let height = null;
  let orientationValue = null;
  let sawScan = false;
  let endOffset = -1;

  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff) {
      return invalidIntegrity('CORRUPT_IMAGE', 'A estrutura de blocos do JPEG é inválida.', { width, height, orientationValue });
    }
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;

    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9) {
      endOffset = offset;
      break;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return invalidIntegrity('TRUNCATED_IMAGE', 'O JPEG termina no meio de um bloco.', { width, height, orientationValue });

    const segmentLength = view.getUint16(offset, false);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      return invalidIntegrity('TRUNCATED_IMAGE', 'O JPEG termina no meio de um bloco.', { width, height, orientationValue });
    }

    const dataStart = offset + 2;
    const dataEnd = offset + segmentLength;
    if (marker === 0xe1 && orientationValue === null) {
      orientationValue = readExifOrientation(bytes.subarray(dataStart, dataEnd));
    }
    if (JPEG_START_OF_FRAME.has(marker) && segmentLength >= 7) {
      height = view.getUint16(offset + 3, false);
      width = view.getUint16(offset + 5, false);
    }
    if (marker === 0xda) {
      sawScan = true;
      endOffset = findJpegEnd(bytes, dataEnd);
      break;
    }

    offset += segmentLength;
  }

  if (!validDimensions(width, height)) return invalidIntegrity('INVALID_DIMENSIONS', 'Não foi possível validar as dimensões do JPEG.', { orientationValue });
  if (!sawScan || endOffset < 0) return invalidIntegrity('TRUNCATED_IMAGE', 'O JPEG não possui um fluxo de imagem completo.', { width, height, orientationValue });
  if (!onlyJpegPadding(bytes, endOffset)) return invalidIntegrity('CORRUPT_IMAGE', 'O JPEG contém dados inesperados após o marcador final.', { width, height, orientationValue });

  return validIntegrity({ width, height, orientationValue });
}

function inspectWebp(bytes) {
  if (bytes.length < 20) return invalidIntegrity('TRUNCATED_IMAGE', 'O arquivo WebP está truncado.');

  const view = dataView(bytes);
  const declaredLength = view.getUint32(4, true) + 8;
  if (declaredLength !== bytes.length) {
    return invalidIntegrity(declaredLength > bytes.length ? 'TRUNCATED_IMAGE' : 'CORRUPT_IMAGE', 'O tamanho declarado no WebP não corresponde aos bytes do arquivo.');
  }

  let offset = 12;
  let width = null;
  let height = null;
  let orientationValue = null;
  let sawImageChunk = false;

  while (offset + 8 <= bytes.length) {
    const type = ascii(bytes, offset, offset + 4);
    const length = view.getUint32(offset + 4, true);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const paddedEnd = dataEnd + (length % 2);
    if (dataEnd < dataStart || paddedEnd > bytes.length) {
      return invalidIntegrity('TRUNCATED_IMAGE', 'O WebP termina no meio de um bloco.', { width, height, orientationValue });
    }

    if (type === 'VP8X' && length >= 10) {
      width = 1 + readUint24LE(bytes, dataStart + 4);
      height = 1 + readUint24LE(bytes, dataStart + 7);
    } else if (type === 'VP8 ' && length >= 10 && startsWith(bytes, [0x9d, 0x01, 0x2a], dataStart + 3)) {
      width = view.getUint16(dataStart + 6, true) & 0x3fff;
      height = view.getUint16(dataStart + 8, true) & 0x3fff;
      sawImageChunk = true;
    } else if (type === 'VP8L' && length >= 5 && bytes[dataStart] === 0x2f) {
      width = 1 + bytes[dataStart + 1] + ((bytes[dataStart + 2] & 0x3f) << 8);
      height = 1 + ((bytes[dataStart + 2] >> 6) & 0x03) + (bytes[dataStart + 3] << 2) + ((bytes[dataStart + 4] & 0x0f) << 10);
      sawImageChunk = true;
    } else if (type === 'EXIF') {
      orientationValue = readExifOrientation(bytes.subarray(dataStart, dataEnd));
    }

    if (type === 'VP8 ' || type === 'VP8L') sawImageChunk = true;
    offset = paddedEnd;
  }

  if (offset !== bytes.length) return invalidIntegrity('CORRUPT_IMAGE', 'A estrutura de blocos do WebP é inválida.', { width, height, orientationValue });
  if (!sawImageChunk || !validDimensions(width, height)) return invalidIntegrity('INVALID_DIMENSIONS', 'Não foi possível validar as dimensões do WebP.', { orientationValue });

  return validIntegrity({ width, height, orientationValue });
}

function readExifOrientation(input) {
  const bytes = toBytes(input);
  let tiffStart = 0;
  if (bytes.length >= 6 && ascii(bytes, 0, 4) === 'Exif' && bytes[4] === 0 && bytes[5] === 0) tiffStart = 6;
  if (tiffStart + 8 > bytes.length) return null;

  const byteOrder = ascii(bytes, tiffStart, tiffStart + 2);
  if (byteOrder !== 'II' && byteOrder !== 'MM') return null;
  const littleEndian = byteOrder === 'II';
  const view = dataView(bytes);
  if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return null;

  const ifdOffset = view.getUint32(tiffStart + 4, littleEndian);
  const directoryStart = tiffStart + ifdOffset;
  if (directoryStart + 2 > bytes.length) return null;
  const entryCount = view.getUint16(directoryStart, littleEndian);

  for (let index = 0; index < entryCount; index += 1) {
    const entry = directoryStart + 2 + (index * 12);
    if (entry + 12 > bytes.length) return null;
    const tag = view.getUint16(entry, littleEndian);
    if (tag !== 0x0112) continue;
    const type = view.getUint16(entry + 2, littleEndian);
    const count = view.getUint32(entry + 4, littleEndian);
    if (type !== 3 || count < 1) return null;
    const value = view.getUint16(entry + 8, littleEndian);
    return value >= 1 && value <= 8 ? value : null;
  }

  return null;
}

function orientationDetails(value) {
  const labels = {
    1: 'Normal',
    2: 'Espelhada horizontalmente',
    3: 'Rotacionada 180°',
    4: 'Espelhada verticalmente',
    5: 'Espelhada e rotacionada 90°',
    6: 'Rotacionada 90°',
    7: 'Espelhada e rotacionada 270°',
    8: 'Rotacionada 270°',
  };
  return {
    value,
    label: value ? labels[value] : 'Sem orientação EXIF pendente',
    requiresTransform: Number.isInteger(value) && value !== 1,
  };
}

function findJpegEnd(bytes, start) {
  for (let offset = start; offset + 1 < bytes.length; offset += 1) {
    if (bytes[offset] !== 0xff) continue;
    let markerOffset = offset + 1;
    while (markerOffset < bytes.length && bytes[markerOffset] === 0xff) markerOffset += 1;
    if (markerOffset >= bytes.length) return -1;
    const marker = bytes[markerOffset];
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset = markerOffset;
      continue;
    }
    if (marker === 0xd9) return markerOffset + 1;
    offset = markerOffset;
  }
  return -1;
}

function onlyJpegPadding(bytes, start) {
  for (let index = start; index < bytes.length; index += 1) {
    if (bytes[index] !== 0x00 && bytes[index] !== 0xff) return false;
  }
  return true;
}

function validIntegrity(values) {
  return { ...values, integrity: { valid: true, code: null, message: null } };
}

function invalidIntegrity(code, message, values = {}) {
  return { ...values, integrity: { valid: false, code, message } };
}

function validDimensions(width, height) {
  return Number.isInteger(width) && width > 0 && Number.isInteger(height) && height > 0;
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function crc32(bytes, start, end) {
  let crc = 0xffffffff;
  for (let index = start; index < end; index += 1) {
    crc ^= bytes[index];
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function startsWith(bytes, expected, offset = 0) {
  if (bytes.length < offset + expected.length) return false;
  return expected.every((value, index) => bytes[offset + index] === value);
}

function ascii(bytes, start, end) {
  let value = '';
  for (let index = start; index < end && index < bytes.length; index += 1) value += String.fromCharCode(bytes[index]);
  return value;
}

function dataView(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function toBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  return new Uint8Array();
}
