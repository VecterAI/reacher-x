function parseIpv4(hostname: string): [number, number, number, number] | null {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d+$/.test(part))) {
    return null;
  }

  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return null;
  }

  return octets as [number, number, number, number];
}

function isPrivateIpv4(address: [number, number, number, number]): boolean {
  const [first, second, third] = address;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0 && (third === 0 || third === 2)) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113) ||
    first >= 224
  );
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, "").split("%")[0];
  if (!normalized.includes(":")) {
    return false;
  }

  const dottedMappedIpv4 = normalized.match(/^::ffff:(\d+(?:\.\d+){3})$/i);
  if (dottedMappedIpv4) {
    const mappedIpv4 = parseIpv4(dottedMappedIpv4[1]);
    return mappedIpv4 ? isPrivateIpv4(mappedIpv4) : false;
  }

  const sections = normalized.split("::");
  if (sections.length > 2) {
    return false;
  }
  const head = sections[0] ? sections[0].split(":").filter(Boolean) : [];
  const tail = sections[1] ? sections[1].split(":").filter(Boolean) : [];
  const zeroCount = sections.length === 2 ? 8 - head.length - tail.length : 0;
  const hextets = [
    ...head,
    ...Array.from({ length: Math.max(zeroCount, 0) }, () => "0"),
    ...tail,
  ];
  if (
    hextets.length !== 8 ||
    hextets.some((hextet) => !/^[\da-f]{1,4}$/i.test(hextet))
  ) {
    return false;
  }

  const values = hextets.map((hextet) => Number.parseInt(hextet, 16));
  if (
    values.slice(0, 5).every((value) => value === 0) &&
    values[5] === 0xffff
  ) {
    const mappedIpv4: [number, number, number, number] = [
      values[6] >> 8,
      values[6] & 0xff,
      values[7] >> 8,
      values[7] & 0xff,
    ];
    return isPrivateIpv4(mappedIpv4);
  }

  const firstHextet = values[0];
  const isUnspecified = values.every((value) => value === 0);
  const isLoopback =
    values.slice(0, 7).every((value) => value === 0) &&
    (values[7] === 0 || values[7] === 1);

  return (
    isUnspecified ||
    isLoopback ||
    (firstHextet & 0xfe00) === 0xfc00 ||
    (firstHextet & 0xffc0) === 0xfe80 ||
    (firstHextet & 0xff00) === 0xff00
  );
}

export function isPrivateHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized === "::1" ||
    normalized.endsWith(".localhost")
  ) {
    return true;
  }

  if (normalized === "metadata.google.internal") {
    return true;
  }

  const ipv4 = parseIpv4(normalized);
  return ipv4 ? isPrivateIpv4(ipv4) : isPrivateIpv6(normalized);
}

export function isPublicHttpUrl(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return false;
    }

    return !isPrivateHostname(parsed.hostname);
  } catch {
    return false;
  }
}
