const JAAS_APP_ID = 'vpaas-magic-cookie-942658495f4c4d25be25fe79ac9c7a9d';
const JAAS_KID = 'vpaas-magic-cookie-942658495f4c4d25be25fe79ac9c7a9d/16b412';

const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC/CYwlwoJsuISy
0gKdmCZXQEpndc/HRh544S/mA7bthX3EsE3tp6j2lFmqO1sBXhGHXBfk1FlV0DTJ
36BX3vOrqEjaS5vzqkZ3GyM3Nbrm/XMY92yg6yVqvdBKtYjpBJgKP0kiuhPEF649
oG3d9Wjfj4wR7qX/Q5vcXYEjDE6orpDSCP/SW7dUYOZj8P4ht43FAo/w0k1uVZvi
6kXOW/yZlzMw4fIvYNLaTIxJ1cUMlJIqH1e08CqzXwvbZtVT4dxOj+0OzVnqbEmU
VDietgYtCqQUMrbDqqaklx3eKixiff0jj3aeaTY2FGZjg2zhuNeE2rL320VLAKgr
GHlCC8AVAgMBAAECggEAOI8QEiHbUWrzxqmMorHoMA7VuHnV0U6+ONWaw8O3xeyu
xqvX9pOb350eStsV33rFP8kRPetso45oApiVtU5J4DmLkC2wd1yjTiIXtAHRWxAQ
ooSmgaH8yvR1lZjXdv2oMeh4s7JZpcXJDW/Q91Tv/rhWJPz94mxW2dBJKmI7a473
jfWVNRnLiIBZfzSkPGivpz3mEu34dh7p+bjzrBphko7psUBpVAq1B+6+QKUeSL9/
RSnzzPa8mk053fHQvUEN8w/p7bd9YLJqGxH30XdMdUjdTdtPZy7te/BebnNKA9Qi
pqeSF+Zzt27FJT6qKlIMkG3uPowi8GQOJkdwjGIkJQKBgQD22PhwOQzZy5xe7Now
izHQFofqs9ePcKw4kf8zD3n77oeEZkXY1AT0FadqugyGVBKpFx7Q35B5FeThjFQk
S6Ghi05vggdelwRHr2I0F9PcGiF8qLCCJvpTCCND4ObggAD2jjMiFv+adNl5w9QQ
A6buZ6E6x2M+MXHuzySX2/1ZOwKBgQDGHtY6kZpTZBBha4eJ4GVPRsgMrh2zXl4W
5vWi4zfLD/zaFAg3ArjiwedZOKmN6XI/xoBSmabC84r41GoDM9iW2qnakkGo1eID
bn16XlZWSrrId7RuV371rDv74vwEZiJuNendIbhu9pfC/zy+FHBd5lGDUZEx9auc
hrgkG+k27wKBgFZuRBbvMtuzmk32erNSmZ91tCNu0wRLfFHWdNfJDHo028h1EvHH
0vAwAM2y1R3XpC0Ghmi2TtzG2LxMqU2IGdD5eP48Nh5dnEcJVsZMrYa8s4r1edAo
m6+lAswKnGxxBWVPBwJhsR/A2ED1W3Q8AyAosuBk3g/xuiXW68YsZfnvAoGALg8V
NuCKxEBLHprlE8S7SMbn0yrXdM/HiAOBr7CrU+YPnpNxpXhYiz8RDckCgh93lCQN
ySY3grMj591aGAyBmfCT9GB0K1AuDyYsvboY0E7nRZuusshcl7jG6TRH6q3j60NV
bzdbrVBez9KOyJHv3aSh5qmb28WFdApN3PcwLLkCgYEAuhR1XFSHuCg5NESMj0lg
k+VghPPCQY9C8GkR/Xq1HbSn78H75UbvIRxNBax3xy+16mTvapu4TfaDELuexyW0
w8iacWED0j0FdDBny0A35zc67pjDs5HNCnwxcoDUGaDvaDwQAURftBXyV12d6y8u
v1cJI7HPI8frCPu+Yy5JhXU=
-----END PRIVATE KEY-----`;

function b64url(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlJson(obj) {
  return b64url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function importKey() {
  const pem = PRIVATE_KEY_PEM
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
}

export async function generateJaaSJwt({ displayName, email, userId }) {
  const key = await importKey();
  const now = Math.floor(Date.now() / 1000);

  const header = b64urlJson({ alg: 'RS256', kid: JAAS_KID, typ: 'JWT' });
  const payload = b64urlJson({
    iss: 'chat',
    iat: now,
    exp: now + 7200,
    nbf: now - 10,
    aud: 'jitsi',
    sub: JAAS_APP_ID,
    room: '*',
    context: {
      user: {
        avatar: '',
        name: displayName,
        email: email || '',
        id: userId || 'guest',
        moderator: 'true',
      },
      features: {
        livestreaming: 'false',
        'outbound-call': 'false',
        transcription: 'false',
        recording: 'false',
      },
    },
  });

  const signingInput = `${header}.${payload}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${b64url(new Uint8Array(sig))}`;
}

export { JAAS_APP_ID };
