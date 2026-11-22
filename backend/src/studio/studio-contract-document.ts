import { BadRequestException } from '@nestjs/common';

export type ContractNode = {
  type: string;
  attrs?: Record<string, unknown>;
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: ContractNode[];
};

const allowedNodes = new Set([
  'doc', 'paragraph', 'text', 'heading', 'bulletList',
  'orderedList', 'listItem', 'blockquote', 'horizontalRule', 'hardBreak',
]);
const allowedMarks = new Set(['bold', 'italic', 'underline', 'strike', 'code', 'link']);
export const contractVariableKeys = [
  'client_name', 'client_email', 'photographer_name', 'photographer_email',
  'project_title', 'event_date', 'location', 'fee', 'today',
] as const;

function string(value: unknown, length: number): string {
  return String(value ?? '').trim().slice(0, length);
}

function linkHref(value: unknown): string {
  const href = string(value, 700);
  if (!href) throw new BadRequestException('Invalid contract link');
  try {
    const target = new URL(href);
    if (!['https:', 'http:', 'mailto:'].includes(target.protocol) ||
        ((target.protocol === 'https:' || target.protocol === 'http:') && (!target.hostname || target.username || target.password)))
      throw new BadRequestException('Unsafe contract hyperlink');
    return target.toString();
  } catch {
    throw new BadRequestException('Unsafe contract hyperlink');
  }
}

/** Keep only supported TipTap/ProseMirror nodes and safe mark attributes. */
export function contractDocument(value: unknown): ContractNode {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid contract document');
  let count = 0;
  let characters = 0;
  const visit = (input: unknown, depth: number): ContractNode => {
    if (!input || typeof input !== 'object' || Array.isArray(input) || depth > 16 || ++count > 1200)
      throw new BadRequestException('Contract document is too complex');
    const raw = input as Record<string, unknown>;
    const type = String(raw.type || '');
    if (!allowedNodes.has(type)) throw new BadRequestException('Unsupported contract formatting');
    const result: ContractNode = { type };
    if (type === 'text') {
      if (typeof raw.text !== 'string') throw new BadRequestException('Invalid contract text');
      characters += raw.text.length;
      if (characters > 25000) throw new BadRequestException('Contract text is too long');
      result.text = raw.text;
      if (Array.isArray(raw.marks)) {
        result.marks = raw.marks.slice(0, 10).map(mark => {
          if (!mark || typeof mark !== 'object' || Array.isArray(mark))
            throw new BadRequestException('Invalid formatting mark');
          const rawMark = mark as Record<string, unknown>;
          const markType = String(rawMark.type || '');
          if (!allowedMarks.has(markType)) throw new BadRequestException('Unsupported text mark');
          return markType === 'link'
            ? { type: 'link', attrs: { href: linkHref((rawMark.attrs as Record<string, unknown> | undefined)?.href) } }
            : { type: markType };
        });
      }
    } else {
      if (type === 'heading') {
        const level = Number((raw.attrs as Record<string, unknown> | undefined)?.level ?? 2);
        if (![1, 2, 3].includes(level)) throw new BadRequestException('Invalid heading level');
        result.attrs = { level };
      }
      if (raw.content !== undefined) {
        if (!Array.isArray(raw.content) || raw.content.length > 1200)
          throw new BadRequestException('Invalid contract content');
        result.content = raw.content.map(child => visit(child, depth + 1));
      }
    }
    return result;
  };
  const result = visit(value, 0);
  if (result.type !== 'doc') throw new BadRequestException('Contract must be a document');
  if (JSON.stringify(result).length > 35000) throw new BadRequestException('Contract document is too large');
  return result;
}

export function contractVariables(value: unknown): Record<string, string> {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value))
    throw new BadRequestException('Invalid contract variables');
  const raw = value as Record<string, unknown>;
  return Object.fromEntries(contractVariableKeys.map(key => [
    key, string(raw[key], key === 'fee' ? 160 : 250),
  ]));
}
