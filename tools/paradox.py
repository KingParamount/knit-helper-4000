"""Minimal pure-Python Paradox (.DB) table reader.

Handles the field types actually used by Knitware: Alpha, Number (double),
Short, Long, AutoInc, Date, Logical, Memo-ref. Enough for SizeStd/SizeCstm/
Pattd/Design tables. No external dependencies.
"""
import struct

# pxlib field type constants
ALPHA, DATE, SHORT, LONG, CURRENCY, NUMBER = 0x01, 0x02, 0x03, 0x04, 0x05, 0x06
LOGICAL = 0x09
MEMOBLOB, BLOB, FMTMEMOBLOB, OLE, GRAPHIC = 0x0C, 0x0D, 0x0E, 0x0F, 0x10
TIME, TIMESTAMP, AUTOINC, BCD, BYTES = 0x14, 0x15, 0x16, 0x17, 0x18

TYPENAME = {
    ALPHA: "Alpha", DATE: "Date", SHORT: "Short", LONG: "Long",
    CURRENCY: "Currency", NUMBER: "Number", LOGICAL: "Logical",
    MEMOBLOB: "Memo", BLOB: "Blob", FMTMEMOBLOB: "FmtMemo", OLE: "OLE",
    GRAPHIC: "Graphic", TIME: "Time", TIMESTAMP: "Timestamp",
    AUTOINC: "AutoInc", BCD: "BCD", BYTES: "Bytes",
}


def _decode_double(b):
    if b == b"\x00" * 8:
        return None
    b = bytearray(b)
    if b[0] & 0x80:
        b[0] &= 0x7F
    else:
        b = bytearray((~x) & 0xFF for x in b)
    return struct.unpack(">d", bytes(b))[0]


def _decode_int(b):
    if b == b"\x00" * len(b):
        return None
    b = bytearray(b)
    if b[0] & 0x80:
        b[0] &= 0x7F
        neg = False
    else:
        b = bytearray((~x) & 0xFF for x in b)
        neg = True
    v = int.from_bytes(bytes(b), "big")
    return -v if neg else v


class ParadoxTable:
    def __init__(self, path, encoding="cp1252"):
        self.path = path
        self.encoding = encoding
        self.raw = open(path, "rb").read()
        self._parse_header()

    def _parse_header(self):
        d = self.raw
        self.record_size, self.header_size = struct.unpack("<HH", d[0:4])
        self.file_type = d[4]
        self.block_size = d[5] * 1024
        self.num_records = struct.unpack("<I", d[6:10])[0]
        self.used_blocks, self.file_blocks = struct.unpack("<HH", d[10:14])
        self.first_block, self.last_block = struct.unpack("<HH", d[14:18])
        self.num_fields = d[0x21]  # single byte works for <256 fields
        if self.num_fields == 0:
            self.num_fields = struct.unpack("<H", d[0x21:0x23])[0]

        # field type/size pairs
        fi = 0x78
        self.fields = []
        for i in range(self.num_fields):
            ftype, fsize = d[fi + i * 2], d[fi + i * 2 + 1]
            self.fields.append({"type": ftype, "size": fsize})

        # verify record size
        calc = sum(f["size"] for f in self.fields)
        self.record_size_ok = calc == self.record_size

        # field names: after fieldinfo comes tableNamePtr(4) + fieldNamePtrs(4*n)
        p = fi + self.num_fields * 2 + 4 + self.num_fields * 4
        # table name (null-terminated), then field names
        end = d.index(b"\x00", p)
        self.table_name = d[p:end].decode("latin-1")
        p = end + 1
        # table name is padded; skip to the run of names
        while d[p] == 0:
            p += 1
        for f in self.fields:
            end = d.index(b"\x00", p)
            f["name"] = d[p:end].decode("latin-1")
            p = end + 1

    def schema(self):
        return [(f["name"], TYPENAME.get(f["type"], hex(f["type"])), f["size"])
                for f in self.fields]

    def _decode_record(self, rec):
        out = {}
        off = 0
        for f in self.fields:
            b = rec[off:off + f["size"]]
            off += f["size"]
            t = f["type"]
            if t == ALPHA:
                s = b.split(b"\x00")[0].decode(self.encoding, "replace").rstrip()
                out[f["name"]] = s if s else None
            elif t in (NUMBER, CURRENCY):
                out[f["name"]] = _decode_double(b)
            elif t in (SHORT, LONG, AUTOINC, DATE, TIME):
                out[f["name"]] = _decode_int(b)
            elif t == LOGICAL:
                out[f["name"]] = None if b == b"\x00" else bool(b[0] & 0x7F)
            else:
                out[f["name"]] = b.hex()
        return out

    def records(self):
        d = self.raw
        blk = self.first_block
        seen = set()
        while blk and blk not in seen:
            seen.add(blk)
            base = self.header_size + (blk - 1) * self.block_size
            nxt, prv, add = struct.unpack("<HHh", d[base:base + 6])
            n = add // self.record_size + 1 if add >= 0 else 0
            for i in range(n):
                s = base + 6 + i * self.record_size
                yield self._decode_record(d[s:s + self.record_size])
            blk = nxt
