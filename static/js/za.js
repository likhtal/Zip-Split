
// Signatures
const LOCAL_FILE_HEADER = 0x504b0304;
const CENTRAL_FILE_HEADER = 0x504b0102;
const CENTRAL_DIRECTORY_END = 0x504b0506;
const ZIP64_CENTRAL_DIRECTORY_LOCATOR = 0x504b0607;
const ZIP64_CENTRAL_DIRECTORY_END = 0x504b0606;
const DATA_DESCRIPTOR = 0x504b0708;

export async function analyseZip(data) {
  const zipLength = data.length;
  const infoEOCD = { ...findEOCD(data), zipLength };
  
  const { endoffset, offset, entriesLeft, entriesTotal, cdSize } = infoEOCD;

  if (offset >= data.length || offset <= 0) {
     const error = "EOCD not found or malformed.";
     return { error };
  }

  const entries = getEntries(data, {endoffset, offset, entriesLeft});
  return { entries,  infoEOCD };
}

function verifyEligibility(entry, filters) {
  return filters.map(q => q(entry)).every(q => q)
}

export async function modifyZip(data, zipInfo, options) {
  const settings = Object.assign({}, {filters: [], commands:[]}, options);
  eulog.log(settings);
  
  const {entries, infoEOCD} = zipInfo;
  let { endoffset, offset, entriesLeft, entriesTotal, cdSize, zipLength } = infoEOCD;

  let newSize = zipLength - endoffset;  // EOCD
  let newCount = 0;
  let newOffset = 0;
  let newCdSize = 0;
  let newCdOffset = 0;

  for (const entry of entries) {
     if (!verifyEligibility(entry, settings.filters)) {
        continue;
     }

     entry["nf"] = {};
     newSize += entry.eSize;
     newSize += entry.finfo.totalSize;
  }

  let tmp = new Uint8Array(newSize);

  // first selected LFH+file+DD (saving new offset)
  // no modifications
  for (const entry of entries) {
     if (!verifyEligibility(entry, settings.filters)) {
        continue;
     }

     newCount += 1;
     let sliceAb = data.subarray(entry.finfo.offset, entry.finfo.offset + entry.finfo.totalSize);

     tmp.set(new Uint8Array(sliceAb), newOffset);

     entry.nf.offset = newOffset;
     newOffset += entry.finfo.totalSize;
  }

  // Then selected CDs (saving new offset)
  // 42	4 Relative offset of local file header. This is the number of bytes between the start of the first disk on which the file occurs, and the start of the local file header. This allows software reading the central directory to locate the position of the file inside the ZIP file.
  // const lfhOffset = view.getUint32(offset + 42, true);

  newCdOffset = newOffset;

  for (const entry of entries) {
     if (!verifyEligibility(entry, settings.filters)) {
        continue;
     }

     newCdSize += entry.eSize;
     let sliceAb = data.buffer.slice(entry.eOffset, entry.eOffset + entry.eSize); // slice - since modifications

     let view = new DataView(sliceAb);
     view.setUint32(42, entry.nf.offset, true);

     tmp.set(new Uint8Array(sliceAb), newOffset);
     newOffset += entry.eSize;
  }

  // finally: EOCD

/*
8	2	Number of central directory records on this disk
10	2	Total number of central directory records
12	4	Size of central directory (bytes)
16	4	Offset of start of central directory, relative to start of archive
*/

  let sliceAbEOCD = data.buffer.slice(endoffset, endoffset + zipLength); // slice - since modifications
  let viewEOCD = new DataView(sliceAbEOCD);

  viewEOCD.setUint16(8, newCount, true);
  viewEOCD.setUint16(10, newCount, true);
  viewEOCD.setUint32(12, newCdSize, true);
  viewEOCD.setUint32(16, newCdOffset, true);

  tmp.set(new Uint8Array(sliceAbEOCD), newOffset);

  return tmp;
}

/*
0	4	End of central directory signature = 0x06054b50
4	2	Number of this disk
6	2	Disk where central directory starts
8	2	Number of central directory records on this disk
10	2	Total number of central directory records
12	4	Size of central directory (bytes)
16	4	Offset of start of central directory, relative to start of archive
20	2	Comment length (n)
22	n	Comment
*/

function findEOCD(data) {
  // Find EOCD (0xFFFF is the maximum size of an optional trailing comment).
  var view = new DataView(data.buffer, data.byteOffset, data.length);

  let entriesLeft = 0;
  let entriesTotal = 0;
  let cdSize = 0;
  let offset = 0;
  let endoffset = data.length;

  for (var i = data.length - 22, ii = Math.max(0, i - 0xFFFF); i >= ii; --i) {
    if (view.getUint32(i) == CENTRAL_DIRECTORY_END) {
        endoffset = i;
        offset = view.getUint32(i + 16, true);
        entriesLeft = view.getUint16(i + 8, true);
        entriesTotal = view.getUint16(i + 10, true);
        cdSize = view.getUint32(i + 12, true);
        break;
    }
  }

  return { endoffset, offset, entriesLeft, entriesTotal, cdSize };
}

/*
0	4	Central directory file header signature = 0x02014b50
4	2	Version made by
6	2	Version needed to extract (minimum)
8	2	General purpose bit flag
10	2	Compression method
12	2	File last modification time
14	2	File last modification date
16	4	CRC-32
20	4	Compressed size
24	4	Uncompressed size
28	2	File name length (n)
30	2	Extra field length (m)
32	2	File comment length (k)
34	2	Disk number where file starts
36	2	Internal file attributes
38	4	External file attributes
42	4	Relative offset of local file header. This is the number of bytes between the start of the first disk on which the file occurs, and the start of the local file header. This allows software reading the central directory to locate the position of the file inside the ZIP file.
46	n	File name
46+n	m	Extra field
46+n+m	k	File comment

General purpose bit flag:
Bit 00: encrypted file
Bit 01: compression option
Bit 02: compression option
Bit 03: data descriptor
Bit 04: enhanced deflation
Bit 05: compressed patched data
Bit 06: strong encryption
Bit 07-10: unused
Bit 11: language encoding
Bit 12: reserved
Bit 13: mask header values
Bit 14-15: reserved

00010000, 00010000
*/

function getEntries(data, {endoffset, offset, entriesLeft}) {
  var view = new DataView(data.buffer, data.byteOffset, data.length);

  let entries = [];

  endoffset -= 46;  // 46 = minimum size of an entry in the central directory.

  while (--entriesLeft >= 0 && offset < endoffset) {
    if (view.getUint32(offset) != CENTRAL_FILE_HEADER) {
      break;
    }

    const bitFlag = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const fileNameLength = view.getUint16(offset + 28, true);
    const extraFieldLength = view.getUint16(offset + 30, true);
    const fileCommentLength = view.getUint16(offset + 32, true);
    const lfhOffset = view.getUint32(offset + 42, true);
    const utfq = (bitFlag & 0x800) ? 'utf-8' : 'ascii';
    const filename = new TextDecoder(utfq).decode(data.subarray(offset + 46, offset + 46 + fileNameLength));

    entries.push({
      directory: filename.endsWith('/'),
      filename: filename,
      compressedSize: compressedSize,
      uncompressedSize: uncompressedSize,
      eOffset: offset,
      eSize: 46 + fileNameLength + extraFieldLength + fileCommentLength,
      lfhOffset: lfhOffset,
    });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  for (let entry of entries) {
     entry['finfo'] = getLFH(data, entry['lfhOffset'], entry['compressedSize']);
  }

  return entries;
}

/*
0	4	Local file header signature = 0x04034b50 (read as a little-endian number)
4	2	Version needed to extract (minimum)
6	2	General purpose bit flag
8	2	Compression method
10	2	File last modification time
12	2	File last modification date
14	4	CRC-32
18	4	Compressed size
22	4	Uncompressed size
26	2	File name length (n)
28	2	Extra field length (m)
30	n	File name
30+n	m	Extra field

General purpose bit flag:
Bit 00: encrypted file
Bit 01: compression option
Bit 02: compression option
Bit 03: data descriptor
Bit 04: enhanced deflation
Bit 05: compressed patched data
Bit 06: strong encryption
Bit 07-10: unused
Bit 11: language encoding
Bit 12: reserved
Bit 13: mask header values
Bit 14-15: reserved

0	0/4	Optional data descriptor signature = 0x08074b50
0/4	4	CRC-32
4/8	4	Compressed size
8/12	4	Uncompressed size

*/

function getLFH(data, offset, size) {
  var view = new DataView(data.buffer, data.byteOffset, data.length);

  if (view.getUint32(offset) != LOCAL_FILE_HEADER) {
    return { fileStart: 0, fileLength:0, ddq: false, offset: 0, totalSize: 0 }
  }

  const bitFlag = view.getUint16(offset + 6, true);
  const fileNameLength = view.getUint16(offset + 26, true);  // n
  const extraFieldLength = view.getUint16(offset + 28, true);  // m

  // If the bit at offset 3 (0x08) of the general-purpose flags field is set, 
  // then there should be a data descriptor.
  const ddq = (bitFlag & 0x08) ? true : false;

  let fileStart = offset + 30 + fileNameLength + extraFieldLength;
  let fileLength = size;

  let ddSize = 0;
  if (ddq) {
    if (view.getUint32(fileStart + fileLength) != DATA_DESCRIPTOR) {
       ddSize = 12;
       fileLength = view.getUint32(fileStart + fileLength + 4, true);
    } else {
       ddSize = 16;
       fileLength = view.getUint32(fileStart + fileLength + 8, true);
    }
  }

  const totalSize = 30 + fileNameLength + extraFieldLength + fileLength + ddSize;

  return { fileStart, fileLength, ddq, offset, totalSize };
}
