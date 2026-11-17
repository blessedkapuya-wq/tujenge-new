import type { AuthUser } from './vicoba';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function hashSecret(secret: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 60000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return `${toBase64Url(saltBytes)}.${toBase64Url(new Uint8Array(derivedBits))}`;
}

export async function verifySecret(secret: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split('.');
  if (parts.length !== 2) return false;
  const [saltPart, hashPart] = parts;
  const saltBytes = fromBase64Url(saltPart);
  const expectedBytes = fromBase64Url(hashPart);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(saltBytes).buffer,
      iterations: 60000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  const actualBytes = new Uint8Array(derivedBits);
  if (actualBytes.length !== expectedBytes.length) return false;

  let diff = 0;
  for (let i = 0; i < actualBytes.length; i++) {
    diff |= actualBytes[i] ^ expectedBytes[i];
  }
  return diff === 0;
}

async function getHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export interface SessionPayload {
  sub: string;
  role: AuthUser['role'];
  displayName: string;
  phone: string | null;
  email: string | null;
  memberId: string | null;
  memberNumber: string | null;
  exp: number;
}

export async function signSessionToken(user: AuthUser, secret: string): Promise<string> {
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payloadObj: SessionPayload = {
    sub: user.id,
    role: user.role,
    displayName: user.displayName,
    phone: user.phone,
    email: user.email,
    memberId: user.memberId,
    memberNumber: user.memberNumber,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  };
  const payload = toBase64Url(encoder.encode(JSON.stringify(payloadObj)));
  const signingInput = `${header}.${payload}`;
  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signingInput));
  return `${signingInput}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(
  token: string,
  secret: string
): Promise<AuthUser | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const key = await getHmacKey(secret);
    const sigBytes = fromBase64Url(signature);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      new Uint8Array(sigBytes).buffer,
      encoder.encode(`${header}.${payload}`)
    );
    if (!valid) return null;

    const decoded = JSON.parse(decoder.decode(fromBase64Url(payload))) as SessionPayload;
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      id: decoded.sub,
      role: decoded.role,
      displayName: decoded.displayName,
      phone: decoded.phone,
      email: decoded.email,
      memberId: decoded.memberId,
      memberNumber: decoded.memberNumber,
    };
  } catch {
    return null;
  }
}
