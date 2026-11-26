/**
 * Safe recursive-descent parser for JSON and relaxed Mongo shell object notation
 * (supports unquoted keys, single-quoted strings, trailing commas, and
 * ObjectId("...") / ISODate("...") literals without using eval or Function).
 */

type TokenType =
  | 'LBRACE'
  | 'RBRACE'
  | 'LBRACKET'
  | 'RBRACKET'
  | 'COLON'
  | 'COMMA'
  | 'STRING'
  | 'NUMBER'
  | 'IDENT'
  | 'LPAREN'
  | 'RPAREN'
  | 'EOF';

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '{') {
      tokens.push({type: 'LBRACE', value: ch, pos: i++});
      continue;
    }
    if (ch === '}') {
      tokens.push({type: 'RBRACE', value: ch, pos: i++});
      continue;
    }
    if (ch === '[') {
      tokens.push({type: 'LBRACKET', value: ch, pos: i++});
      continue;
    }
    if (ch === ']') {
      tokens.push({type: 'RBRACKET', value: ch, pos: i++});
      continue;
    }
    if (ch === ':') {
      tokens.push({type: 'COLON', value: ch, pos: i++});
      continue;
    }
    if (ch === ',') {
      tokens.push({type: 'COMMA', value: ch, pos: i++});
      continue;
    }
    if (ch === '(') {
      tokens.push({type: 'LPAREN', value: ch, pos: i++});
      continue;
    }
    if (ch === ')') {
      tokens.push({type: 'RPAREN', value: ch, pos: i++});
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      let str = '';
      let closed = false;
      while (i < len) {
        const c = input[i];
        if (c === '\\') {
          i++;
          if (i >= len) break;
          const esc = input[i];
          if (esc === 'n') str += '\n';
          else if (esc === 'r') str += '\r';
          else if (esc === 't') str += '\t';
          else if (esc === '\\') str += '\\';
          else if (esc === '"') str += '"';
          else if (esc === "'") str += "'";
          else if (esc === 'u') {
            const hex = input.slice(i + 1, i + 5);
            if (/^[0-9a-fA-F]{4}$/.test(hex)) {
              str += String.fromCharCode(parseInt(hex, 16));
              i += 4;
            } else {
              str += 'u';
            }
          } else {
            str += esc;
          }
          i++;
          continue;
        }
        if (c === quote) {
          closed = true;
          i++;
          break;
        }
        str += c;
        i++;
      }
      if (!closed) {
        throw new Error(`Unterminated string starting at position ${start}`);
      }
      tokens.push({type: 'STRING', value: str, pos: start});
      continue;
    }

    if (ch === '-' || /[0-9]/.test(ch)) {
      const start = i;
      let numStr = '';
      if (ch === '-') {
        numStr += ch;
        i++;
      }
      while (i < len && /[0-9]/.test(input[i])) {
        numStr += input[i++];
      }
      if (i < len && input[i] === '.') {
        numStr += '.';
        i++;
        while (i < len && /[0-9]/.test(input[i])) {
          numStr += input[i++];
        }
      }
      if (i < len && (input[i] === 'e' || input[i] === 'E')) {
        numStr += input[i++];
        if (i < len && (input[i] === '+' || input[i] === '-')) {
          numStr += input[i++];
        }
        while (i < len && /[0-9]/.test(input[i])) {
          numStr += input[i++];
        }
      }
      const parsed = Number(numStr);
      if (Number.isNaN(parsed) || numStr === '-') {
        throw new Error(`Invalid number "${numStr}" at position ${start}`);
      }
      tokens.push({type: 'NUMBER', value: numStr, pos: start});
      continue;
    }

    if (/[a-zA-Z_$]/.test(ch)) {
      const start = i;
      let ident = '';
      while (i < len && /[a-zA-Z0-9_$.-]/.test(input[i])) {
        ident += input[i++];
      }
      tokens.push({type: 'IDENT', value: ident, pos: start});
      continue;
    }

    throw new Error(`Unexpected character "${ch}" at position ${i}`);
  }

  tokens.push({type: 'EOF', value: '', pos: len});
  return tokens;
}

export interface ObjectIdMarker {
  __isObjectId: true;
  value: string;
}

export interface DateMarker {
  __isDate: true;
  value: string;
}

export function isObjectIdMarker(v: unknown): v is ObjectIdMarker {
  return typeof v === 'object' && v !== null && (v as ObjectIdMarker).__isObjectId === true;
}

export function isDateMarker(v: unknown): v is DateMarker {
  return typeof v === 'object' && v !== null && (v as DateMarker).__isDate === true;
}

export function parseRelaxedJson(raw: string, fallback?: unknown): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (fallback !== undefined) return fallback;
    throw new Error('Empty JSON input');
  }

  const tokens = tokenize(trimmed);
  let idx = 0;

  function peek(): Token {
    return tokens[idx];
  }

  function consume(): Token {
    return tokens[idx++];
  }

  function parseValue(): unknown {
    const t = peek();
    if (t.type === 'LBRACE') return parseObject();
    if (t.type === 'LBRACKET') return parseArray();
    if (t.type === 'STRING') {
      consume();
      return t.value;
    }
    if (t.type === 'NUMBER') {
      consume();
      return Number(t.value);
    }
    if (t.type === 'IDENT') {
      consume();
      if (t.value === 'true') return true;
      if (t.value === 'false') return false;
      if (t.value === 'null') return null;

      if ((t.value === 'ObjectId' || t.value === 'ISODate' || t.value === 'Date') && peek().type === 'LPAREN') {
        consume(); // LPAREN
        const arg = peek();
        let inner = '';
        if (arg.type === 'STRING') {
          consume();
          inner = arg.value;
        } else if (arg.type !== 'RPAREN') {
          throw new Error(`Expected string argument inside ${t.value}() at position ${arg.pos}`);
        }
        if (peek().type !== 'RPAREN') {
          throw new Error(`Expected closing parenthesis for ${t.value}() at position ${peek().pos}`);
        }
        consume(); // RPAREN
        if (t.value === 'ObjectId') {
          return {__isObjectId: true, value: inner} satisfies ObjectIdMarker;
        }
        const dateIso = inner ? new Date(inner).toISOString() : new Date().toISOString();
        return {__isDate: true, value: dateIso} satisfies DateMarker;
      }

      throw new Error(`Unexpected identifier "${t.value}" at position ${t.pos}`);
    }

    throw new Error(`Unexpected token "${t.value || t.type}" at position ${t.pos}`);
  }

  function parseObject(): Record<string, unknown> {
    consume(); // LBRACE
    const obj: Record<string, unknown> = {};

    while (peek().type !== 'RBRACE') {
      const keyToken = peek();
      let key: string;
      if (keyToken.type === 'STRING' || keyToken.type === 'IDENT') {
        consume();
        key = keyToken.value;
      } else {
        throw new Error(`Expected property name at position ${keyToken.pos}`);
      }

      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new Error(`Disallowed property key "${key}"`);
      }

      if (peek().type !== 'COLON') {
        throw new Error(`Expected ":" after key "${key}" at position ${peek().pos}`);
      }
      consume(); // COLON

      const value = parseValue();
      obj[key] = value;

      if (peek().type === 'COMMA') {
        consume();
        if (peek().type === 'RBRACE') break;
      } else if (peek().type !== 'RBRACE') {
        throw new Error(`Expected "," or "}" at position ${peek().pos}`);
      }
    }

    if (peek().type !== 'RBRACE') {
      throw new Error('Unterminated object');
    }
    consume(); // RBRACE
    return obj;
  }

  function parseArray(): unknown[] {
    consume(); // LBRACKET
    const arr: unknown[] = [];

    while (peek().type !== 'RBRACKET') {
      arr.push(parseValue());
      if (peek().type === 'COMMA') {
        consume();
        if (peek().type === 'RBRACKET') break;
      } else if (peek().type !== 'RBRACKET') {
        throw new Error(`Expected "," or "]" at position ${peek().pos}`);
      }
    }

    if (peek().type !== 'RBRACKET') {
      throw new Error('Unterminated array');
    }
    consume(); // RBRACKET
    return arr;
  }

  const result = parseValue();
  if (peek().type !== 'EOF') {
    throw new Error(`Unexpected trailing token "${peek().value}" at position ${peek().pos}`);
  }
  return result;
}
