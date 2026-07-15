"""Decompile Delphi binary DFM resources (TPF0) back to readable text."""
import struct

(vaNull, vaList, vaInt8, vaInt16, vaInt32, vaExtended, vaString, vaIdent,
 vaFalse, vaTrue, vaBinary, vaSet, vaCollection, vaSingle, vaCurrency,
 vaDate, vaWString, vaInt64, vaUTF8String) = range(19)


class R:
    def __init__(self, d):
        self.d, self.p = d, 0

    def u8(self):
        v = self.d[self.p]; self.p += 1; return v

    def take(self, n):
        v = self.d[self.p:self.p + n]; self.p += n; return v

    def pstr(self):
        return self.take(self.u8()).decode('cp1252', 'replace')

    def i32(self):
        return struct.unpack('<i', self.take(4))[0]


def read_value(r):
    t = r.u8()
    if t == vaNull:       return None
    if t == vaInt8:       return struct.unpack('<b', r.take(1))[0]
    if t == vaInt16:      return struct.unpack('<h', r.take(2))[0]
    if t == vaInt32:      return r.i32()
    if t == vaInt64:      return struct.unpack('<q', r.take(8))[0]
    if t == vaExtended:
        b = r.take(10)
        return f'<extended {b.hex()}>'
    if t == vaSingle:     return struct.unpack('<f', r.take(4))[0]
    if t == vaCurrency:   return struct.unpack('<q', r.take(8))[0] / 10000.0
    if t == vaDate:       return struct.unpack('<d', r.take(8))[0]
    if t in (vaString, vaIdent): return r.pstr()
    if t == vaFalse:      return False
    if t == vaTrue:       return True
    if t == vaWString:
        n = r.i32(); return r.take(n * 2).decode('utf-16-le', 'replace')
    if t == vaUTF8String:
        n = r.i32(); return r.take(n).decode('utf-8', 'replace')
    if t == vaBinary:
        n = r.i32(); r.take(n); return f'<binary {n} bytes>'
    if t == vaList:
        out = []
        while r.d[r.p] != 0:
            out.append(read_value(r))
        r.u8()
        return out
    if t == vaSet:
        out = []
        while True:
            s = r.pstr()
            if not s: break
            out.append(s)
        return set(out)
    if t == vaCollection:
        out = []
        while r.d[r.p] != 0:
            b = r.u8()
            if b == vaList: pass
            elif b in (vaInt8, vaInt16, vaInt32):
                r.p -= 1; read_value(r); r.u8()
            else:
                r.p -= 1
            props = {}
            while True:
                name = r.pstr()
                if not name: break
                props[name] = read_value(r)
            out.append(props)
        r.u8()
        return out
    raise ValueError(f'unknown value type {t} at {r.p}')


def read_object(r, depth=0):
    flags = 0
    # TReader.ReadPrefix: a prefix byte is present only when the top nibble is $F
    if (r.d[r.p] & 0xF0) == 0xF0:
        flags = r.u8() & 0x0F
        if flags & 0x02:  # ffChildPos
            read_value(r)
    cls = r.pstr()
    name = r.pstr()
    props = {}
    while True:
        pn = r.pstr()
        if not pn: break
        props[pn] = read_value(r)
    kids = []
    while r.d[r.p] != 0:
        kids.append(read_object(r, depth + 1))
    r.u8()
    return {'class': cls, 'name': name, 'props': props, 'children': kids}


def parse(data):
    r = R(data)
    assert r.take(4) == b'TPF0', 'not a binary DFM'
    return read_object(r)


def to_text(o, ind=0):
    pad = '  ' * ind
    out = [f'{pad}object {o["name"]}: {o["class"]}']
    for k, v in o['props'].items():
        if isinstance(v, list) and v and isinstance(v[0], str):
            out.append(f'{pad}  {k} = (')
            for s in v:
                out.append(f'{pad}    {s!r}')
            out.append(f'{pad}  )')
        else:
            out.append(f'{pad}  {k} = {v!r}')
    for c in o['children']:
        out.append(to_text(c, ind + 1))
    out.append(f'{pad}end')
    return '\n'.join(out)


def walk(o):
    yield o
    for c in o['children']:
        yield from walk(c)
